// WILSONIX MIDIKEY - Native Low-Latency Output Bridge (Oboe)
//
// Replaces only the LAST MILE of the audio path: the JS synth/effects chain
// renders as always, PCM ships over the Capacitor bridge into this lock-free
// ring, and Oboe/AAudio plays it with a ~128-frame burst instead of
// Chromium's ~45ms output pipeline. Any failure here must leave the web path
// fully functional - this engine never touches Chromium's output.
//
// Threading (single-producer single-consumer):
//   Producer : Capacitor "CapacitorPlugins" HandlerThread (write)
//   Consumer : Oboe real-time callback (onAudioReady) - never locks/allocates
//   Control  : same Capacitor thread (configure/stats/stop serialized by it)

#include <jni.h>
#include <oboe/Oboe.h>
#include <android/log.h>

#include <atomic>
#include <cstdio>
#include <cstring>
#include <memory>
#include <mutex>
#include <string>

#define TAG "WILSONIX_AUDIO"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

namespace {

constexpr int kChannels = 2;           // stereo interleave = AudioContext
constexpr size_t kRingFrames = 16384;  // power of two, ~341ms @48k headroom
constexpr size_t kRingMask = kRingFrames - 1;
constexpr double kMaxFillMs = 60.0;    // drift guard: shed oldest past this
constexpr double kPrefillMs = 24.0;    // jitter cushion before playback starts
constexpr double kFadeSec = 0.004;     // click-guard gain ramp time

class FloatRing {
public:
    void reset() {
        mWrite.store(0, std::memory_order_relaxed);
        mRead.store(0, std::memory_order_relaxed);
        mDropped.store(0, std::memory_order_relaxed);
    }

    // Producer. src = raw LE float32 bytes (JNI byte[]). Returns frames written.
    size_t writeBytes(const uint8_t* src, size_t frames) {
        const size_t w = mWrite.load(std::memory_order_relaxed);
        const size_t r = mRead.load(std::memory_order_acquire);
        const size_t freeFrames = kRingFrames - (w - r);
        const size_t n = frames < freeFrames ? frames : freeFrames;
        if (n == 0) return 0;
        const size_t wPos = w & kRingMask;
        const size_t firstFrames = n < (kRingFrames - wPos) ? n : (kRingFrames - wPos);
        std::memcpy(&mData[wPos * kChannels], src,
                    firstFrames * kChannels * sizeof(float));
        if (n > firstFrames) {
            std::memcpy(&mData[0],
                        src + firstFrames * kChannels * sizeof(float),
                        (n - firstFrames) * kChannels * sizeof(float));
        }
        mWrite.store(w + n, std::memory_order_release);
        return n;
    }

    // Consumer (real-time). Drift guard drops oldest frames past highWater.
    size_t read(float* dst, size_t frames, size_t highWaterFrames) {
        size_t r = mRead.load(std::memory_order_relaxed);
        const size_t w = mWrite.load(std::memory_order_acquire);
        size_t avail = w - r;
        if (avail > highWaterFrames) {
            const size_t drop = avail - highWaterFrames;
            r += drop;
            mDropped.fetch_add(drop, std::memory_order_relaxed);
            mRead.store(r, std::memory_order_release);
            avail = highWaterFrames;
        }
        const size_t n = frames < avail ? frames : avail;
        if (n == 0) return 0;
        const size_t rPos = r & kRingMask;
        const size_t firstFrames = n < (kRingFrames - rPos) ? n : (kRingFrames - rPos);
        std::memcpy(dst, &mData[rPos * kChannels],
                    firstFrames * kChannels * sizeof(float));
        if (n > firstFrames) {
            std::memcpy(dst + firstFrames * kChannels, &mData[0],
                        (n - firstFrames) * kChannels * sizeof(float));
        }
        mRead.store(r + n, std::memory_order_release);
        return n;
    }

    size_t fillFrames() const {
        return mWrite.load(std::memory_order_acquire) -
               mRead.load(std::memory_order_acquire);
    }
    int64_t droppedFrames() const { return mDropped.load(std::memory_order_relaxed); }

private:
    float mData[kRingFrames * kChannels] = {};
    std::atomic<size_t> mWrite{0};
    std::atomic<size_t> mRead{0};
    std::atomic<int64_t> mDropped{0};
};

class WilsonixEngine : public oboe::AudioStreamCallback {
public:
    ~WilsonixEngine() { stopInternal(); }

    // Oboe 1.11 replaced getLatency() with calculateLatencyMillis()
    // (timestamp-based, milliseconds; 0 when the platform can't estimate).
    static double latencyMsOf(oboe::AudioStream* s) {
        if (!s) return 0.0;
        auto r = s->calculateLatencyMillis();
        return r ? r.value() : 0.0;
    }

    // Opens (or re-opens) the output stream, relaxing one constraint at a
    // time: LowLatency -> None, Exclusive -> Shared, requested rate -> device
    // native. Format conversion is ALLOWED because Oboe defaults it to false
    // and many HALs only expose PCM_I16 on the low-latency path - without it
    // a Float request fails outright (AudioStreamBase.h mFormatConversionAllowed).
    // Returns JSON {ok,...} or {ok:false,"error":<last Oboe result>}.
    std::string configure(int requestedRate) {
        std::lock_guard<std::mutex> lock(mCtl);
        stopInternal();

        const oboe::SharingMode kShares[] = {oboe::SharingMode::Exclusive,
                                             oboe::SharingMode::Shared};
        const oboe::PerformanceMode kPerfs[] = {oboe::PerformanceMode::LowLatency,
                                                oboe::PerformanceMode::None};
        const int kRates[] = {requestedRate, 0};  // 0 = device native

        oboe::Result r = oboe::Result::ErrorInvalidState;
        for (int p = 0; p < 2 && r != oboe::Result::OK; p++) {
            for (int s = 0; s < 2 && r != oboe::Result::OK; s++) {
                for (int f = 0; f < 2 && r != oboe::Result::OK; f++) {
                    oboe::AudioStreamBuilder b;
                    b.setDirection(oboe::Direction::Output)
                        ->setPerformanceMode(kPerfs[p])
                        ->setSharingMode(kShares[s])
                        ->setFormat(oboe::AudioFormat::Float)
                        ->setFormatConversionAllowed(true)
                        ->setChannelCount(kChannels)
                        ->setUsage(oboe::Usage::Media)          // media volume rocker
                        ->setContentType(oboe::ContentType::Music)
                        ->setSampleRate(kRates[f])
                        ->setSampleRateConversionQuality(
                            oboe::SampleRateConversionQuality::Medium)
                        ->setDataCallback(this)
                        ->setErrorCallback(this);
                    r = b.openStream(mStream);
                    if (r != oboe::Result::OK) {
                        LOGW("open attempt perf=%d share=%d rate=%d -> %s",
                             p, s, kRates[f], oboe::convertToText(r));
                        mStream.reset();
                    }
                }
            }
        }
        if (r != oboe::Result::OK || !mStream) {
            mStream.reset();
            LOGE("openStream failed after full ladder: %s",
                 oboe::convertToText(r));
            return std::string("{\"ok\":false,\"error\":\"") +
                   oboe::convertToText(r) + "\"}";
        }

        mSampleRate = mStream->getSampleRate();
        mHighWaterFrames = (size_t)((kMaxFillMs / 1000.0) * mSampleRate);
        mPrefillFrames = (size_t)((kPrefillMs / 1000.0) * mSampleRate);
        mRing.reset();
        mXruns.store(0, std::memory_order_relaxed);
        mArmed.store(false, std::memory_order_relaxed);
        mStreamError.store(false, std::memory_order_relaxed);
        // Deliberately NOT started yet: playback begins on the first write()
        // that sees the prefill cushion, so the consumer never races an empty
        // ring (producer == consumer rate -> fill would otherwise hover ~0ms
        // and any main-thread stall drained it into an xrun storm).
        mRunning.store(false, std::memory_order_relaxed);
        mFadeGain = 1.0f;
        mFadeTarget = 1.0f;

        char json[384];
        snprintf(json, sizeof(json),
                 "{\"ok\":true,\"sampleRate\":%d,\"channels\":%d,"
                 "\"burst\":%d,\"latencyMs\":%.1f,\"format\":%d}",
                 (int)mSampleRate, kChannels,
                 (int)mStream->getFramesPerBurst(),
                 latencyMsOf(mStream.get()),
                 (int)mStream->getFormat());
        LOGI("engine configured rate=%d burst=%d prefill=%d frames",
             (int)mSampleRate, (int)mStream->getFramesPerBurst(),
             (int)mPrefillFrames);
        return std::string(json);
    }

    // Producer entry. data = interleaved float32 bytes. Returns frames written.
    int write(const uint8_t* data, size_t frames) {
        if (frames == 0) return 0;
        if (!mArmed.exchange(true, std::memory_order_acq_rel)) {
            LOGI("first write - xrun accounting armed");
        }
        const int written = (int)mRing.writeBytes(data, frames);
        // Start playback once the jitter cushion is in place (runs on the
        // Capacitor plugin thread; same thread serializes configure/stats).
        if (!mRunning.load(std::memory_order_acquire) && mStream &&
            mRing.fillFrames() >= mPrefillFrames) {
            const oboe::Result r = mStream->requestStart();
            if (r == oboe::Result::OK) {
                mRunning.store(true, std::memory_order_release);
                LOGI("prefill reached (%dms) - stream started",
                     (int)kPrefillMs);
            } else {
                mStreamError.store(true, std::memory_order_relaxed);
                LOGE("requestStart failed: %s", oboe::convertToText(r));
            }
        }
        return written;
    }

    std::string statsJson() {
        std::lock_guard<std::mutex> lock(mCtl);
        const size_t fill = mRing.fillFrames();
        const double fillMs = mSampleRate > 0
            ? (fill * 1000.0 / mSampleRate) : 0.0;
        double latMs = 0.0;
        int burst = 0;
        bool started = false;
        if (mStream) {
            latMs = latencyMsOf(mStream.get());
            burst = (int)mStream->getFramesPerBurst();
            started = mStream->getState() == oboe::StreamState::Started;
        }
        char json[448];
        snprintf(json, sizeof(json),
                 "{\"ok\":true,\"running\":%s,\"prefilling\":%s,\"error\":%s,"
                 "\"sampleRate\":%d,\"burst\":%d,"
                 "\"latencyMs\":%.1f,\"fillMs\":%.1f,"
                 "\"xruns\":%lld,\"droppedFrames\":%lld}",
                 (started ? "true" : "false"),
                 (mRunning.load(std::memory_order_relaxed) ? "false" : "true"),
                 (mStreamError.load(std::memory_order_relaxed) ? "true" : "false"),
                 (int)mSampleRate, burst, latMs, fillMs,
                 (long long)mXruns.load(std::memory_order_relaxed),
                 (long long)mRing.droppedFrames());
        return std::string(json);
    }

    void stop() {
        std::lock_guard<std::mutex> lock(mCtl);
        stopInternal();
    }

    // --- real-time thread -------------------------------------------------

    oboe::DataCallbackResult onAudioReady(oboe::AudioStream* /*stream*/,
                                          void* audioData,
                                          int32_t numFrames) override {
        float* out = static_cast<float*>(audioData);
        const size_t got = mRing.read(out, (size_t)numFrames, mHighWaterFrames);
        if (got < (size_t)numFrames) {
            std::memset(out + got * kChannels, 0,
                        ((size_t)numFrames - got) * kChannels * sizeof(float));
            if (mArmed.load(std::memory_order_relaxed)) {
                mXruns.fetch_add(1, std::memory_order_relaxed);
            }
            mFadeTarget = 0.0f;
        } else {
            mFadeTarget = 1.0f;
        }
        applyFade(out, numFrames);
        return oboe::DataCallbackResult::Continue;
    }

    void onErrorBeforeClose(oboe::AudioStream*, oboe::Result) override {
        mStreamError.store(true, std::memory_order_relaxed);
    }
    void onErrorAfterClose(oboe::AudioStream*, oboe::Result error) override {
        mStreamError.store(true, std::memory_order_relaxed);
        LOGE("stream error after close: %s", oboe::convertToText(error));
    }

private:
    void applyFade(float* out, int32_t n) {
        const float target = mFadeTarget;
        if (mFadeGain == 1.0f && target == 1.0f) return;  // fast path
        const float step = (float)(1.0 / (kFadeSec * (double)mSampleRate));
        float g = mFadeGain;
        for (int32_t i = 0; i < n; i++) {
            if (g < target) { g += step; if (g > target) g = target; }
            else if (g > target) { g -= step; if (g < target) g = target; }
            out[i * kChannels] *= g;
            out[i * kChannels + 1] *= g;
        }
        mFadeGain = g;
    }

    void stopInternal() {
        mRunning.store(false, std::memory_order_relaxed);
        if (mStream) {
            mStream->requestStop();
            mStream->close();
            mStream.reset();
        }
    }

    std::mutex mCtl;                    // configure/stats/stop (Capacitor thread)
    std::shared_ptr<oboe::AudioStream> mStream;
    FloatRing mRing;
    int mSampleRate = 48000;
    size_t mHighWaterFrames = 48000;    // recomputed on configure
    size_t mPrefillFrames = 1152;       // recomputed on configure
    std::atomic<bool> mArmed{false};
    std::atomic<bool> mRunning{false};  // true once prefill started playback
    std::atomic<bool> mStreamError{false};
    std::atomic<long long> mXruns{0};
    float mFadeGain = 1.0f;             // audio-thread only
    float mFadeTarget = 1.0f;           // audio-thread only
};

// Engine instances are keyed by a jlong handle handed to Java.
WilsonixEngine* fromHandle(jlong h) { return reinterpret_cast<WilsonixEngine*>(h); }

}  // namespace

// --- JNI surface: com.wilsonix.midikey.AudioBridgePlugin -------------------

extern "C" {

JNIEXPORT jlong JNICALL
Java_com_wilsonix_midikey_AudioBridgePlugin_nativeCreate(JNIEnv*, jclass) {
    return reinterpret_cast<jlong>(new WilsonixEngine());
}

JNIEXPORT jstring JNICALL
Java_com_wilsonix_midikey_AudioBridgePlugin_nativeConfigure(JNIEnv* env, jclass,
                                                            jlong handle,
                                                            jint sampleRate) {
    WilsonixEngine* e = fromHandle(handle);
    if (!e) return env->NewStringUTF("{\"ok\":false,\"error\":\"no engine\"}");
    std::string json = e->configure(sampleRate);
    return env->NewStringUTF(json.c_str());
}

JNIEXPORT jint JNICALL
Java_com_wilsonix_midikey_AudioBridgePlugin_nativeWrite(JNIEnv* env, jclass,
                                                        jlong handle,
                                                        jbyteArray data,
                                                        jint frames) {
    WilsonixEngine* e = fromHandle(handle);
    if (!e || !data || frames <= 0) return 0;
    const jsize len = env->GetArrayLength(data);
    if (len < frames * kChannels * (jsize)sizeof(float)) return -1;
    jbyte* bytes = env->GetByteArrayElements(data, nullptr);
    if (!bytes) return -1;
    int written = e->write(reinterpret_cast<const uint8_t*>(bytes), (size_t)frames);
    env->ReleaseByteArrayElements(data, bytes, JNI_ABORT);  // never copy back
    return written;
}

JNIEXPORT jstring JNICALL
Java_com_wilsonix_midikey_AudioBridgePlugin_nativeStats(JNIEnv* env, jclass,
                                                        jlong handle) {
    WilsonixEngine* e = fromHandle(handle);
    if (!e) return env->NewStringUTF("{\"ok\":false,\"error\":\"no engine\"}");
    std::string json = e->statsJson();
    return env->NewStringUTF(json.c_str());
}

JNIEXPORT void JNICALL
Java_com_wilsonix_midikey_AudioBridgePlugin_nativeStop(JNIEnv*, jclass, jlong handle) {
    WilsonixEngine* e = fromHandle(handle);
    if (e) e->stop();
}

JNIEXPORT void JNICALL
Java_com_wilsonix_midikey_AudioBridgePlugin_nativeDestroy(JNIEnv*, jclass, jlong handle) {
    delete fromHandle(handle);
}

}  // extern "C"

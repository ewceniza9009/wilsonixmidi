import os
import sys
import numpy as np
import soundfile as sf
import librosa

STEM_DIR = r"x:\midikey\scratch\stems\htdemucs\Synthesizer You"
OUT_SAMPLES_DIR = r"x:\midikey\public\samples\synthesizer_you"
os.makedirs(OUT_SAMPLES_DIR, exist_ok=True)

def normalize_audio(y, target_peak=0.95):
    max_val = np.max(np.abs(y))
    if max_val > 0:
        return y * (target_peak / max_val)
    return y

def save_sample(y, sr, name):
    filepath = os.path.join(OUT_SAMPLES_DIR, f"{name}.wav")
    sf.write(filepath, y.T if y.ndim > 1 else y, sr, subtype='PCM_16')
    print(f"Saved: {filepath} ({y.shape[-1]/sr:.2f}s)")
    return filepath

def main():
    if not os.path.exists(STEM_DIR):
        print("Stem dir not found yet:", STEM_DIR)
        return

    print("Loading separated stems...")
    other_path = os.path.join(STEM_DIR, "other.wav")
    drums_path = os.path.join(STEM_DIR, "drums.wav")
    bass_path = os.path.join(STEM_DIR, "bass.wav")
    vocals_path = os.path.join(STEM_DIR, "vocals.wav")

    # Load audio
    y_other, sr = librosa.load(other_path, sr=44100, mono=False)
    y_drums, _ = librosa.load(drums_path, sr=44100, mono=False)
    y_bass, _ = librosa.load(bass_path, sr=44100, mono=False)
    y_vox, _ = librosa.load(vocals_path, sr=44100, mono=False)

    total_len_sec = y_other.shape[1] / sr
    print(f"Loaded stems. Duration: {total_len_sec:.2f}s at {sr}Hz")

    # Detect tempo from drums & other
    onset_env = librosa.onset.onset_strength(y=y_drums[0], sr=sr)
    tempo, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
    bpm = float(tempo[0]) if isinstance(tempo, (list, np.ndarray)) else float(tempo)
    print(f"Estimated BPM: {bpm:.1f}")

    # 1. Intro Stereo Chorus Synth Swell (First 6 seconds)
    swell_samples = int(sr * 6.0)
    swell = normalize_audio(y_other[:, 0:swell_samples])
    save_sample(swell, sr, "synth_chorus_pad_swell")

    # 2. Surf Synth Pluck / Spring Reverb Lead Riff (Seconds 8 to 16)
    surf_start = int(sr * 8.0)
    surf_end = int(sr * 16.0)
    surf_pluck = normalize_audio(y_other[:, surf_start:surf_end])
    save_sample(surf_pluck, sr, "surf_spring_synth_riff")

    # 3. Gated Snare Hits from drums
    snare_onset_env = librosa.onset.onset_strength(y=y_drums[0], sr=sr)
    drum_onsets = librosa.onset.onset_detect(onset_envelope=snare_onset_env, sr=sr, units='samples')
    
    if len(drum_onsets) > 5:
        snare_hit_1 = normalize_audio(y_drums[:, drum_onsets[2]:drum_onsets[2] + int(sr * 0.7)])
        save_sample(snare_hit_1, sr, "gated_snare_cannon_1")
        
        snare_hit_2 = normalize_audio(y_drums[:, drum_onsets[4]:drum_onsets[4] + int(sr * 0.7)])
        save_sample(snare_hit_2, sr, "gated_snare_cannon_2")

    # 4. Slapback Vocal Chops from vocals.wav
    vox_onsets = librosa.onset.onset_detect(y=y_vox[0], sr=sr, units='samples')
    if len(vox_onsets) > 0:
        for idx, onset in enumerate(vox_onsets[:4]):
            v_slice = normalize_audio(y_vox[:, onset:onset + int(sr * 1.8)])
            save_sample(v_slice, sr, f"slapback_vox_chop_{idx+1}")

    # 5. Analog Bass Synth Riff (from bass.wav)
    bass_start = int(sr * 16.0)
    bass_end = int(sr * 24.0)
    bass_riff = normalize_audio(y_bass[:, bass_start:bass_end])
    save_sample(bass_riff, sr, "analog_synth_bass_riff")

    # 6. Full 4-Bar Synchronized Backing Groove Loop
    beat_dur = 60.0 / bpm
    four_bars_sec = 16 * beat_dur
    four_bars_samples = int(four_bars_sec * sr)
    
    groove_start = int(sr * 32.0)
    groove_mix = normalize_audio(
        (y_other[:, groove_start:groove_start + four_bars_samples] * 0.8) +
        (y_drums[:, groove_start:groove_start + four_bars_samples] * 0.9) +
        (y_bass[:, groove_start:groove_start + four_bars_samples] * 0.85)
    )
    save_sample(groove_mix, sr, "synthesizer_you_4bar_groove")

    # 7. Pure Synth & FX Stems for Looper / Layering
    synth_loop = normalize_audio(y_other[:, groove_start:groove_start + four_bars_samples])
    save_sample(synth_loop, sr, "synthesizer_you_synth_loop")

    drums_loop = normalize_audio(y_drums[:, groove_start:groove_start + four_bars_samples])
    save_sample(drums_loop, sr, "synthesizer_you_drum_loop")

    print("\nAll Synthesizer You sound effects and samples successfully extracted!")

if __name__ == "__main__":
    main()

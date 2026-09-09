import os
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
    print("Extracting extra one-shots, sweeps, and instrument notes...")
    other_path = os.path.join(STEM_DIR, "other.wav")
    drums_path = os.path.join(STEM_DIR, "drums.wav")
    bass_path = os.path.join(STEM_DIR, "bass.wav")
    vocals_path = os.path.join(STEM_DIR, "vocals.wav")

    y_other, sr = librosa.load(other_path, sr=44100, mono=False)
    y_drums, _ = librosa.load(drums_path, sr=44100, mono=False)
    y_bass, _ = librosa.load(bass_path, sr=44100, mono=False)
    y_vox, _ = librosa.load(vocals_path, sr=44100, mono=False)

    # 1. Isolated Surf Synth Single Pluck Note (for chromatic multisampling)
    # Find onset around second 8-12
    sub_y = y_other[0, int(sr*8):int(sr*14)]
    onsets = librosa.onset.onset_detect(y=sub_y, sr=sr, units='samples')
    if len(onsets) > 0:
        first_note_start = int(sr*8) + onsets[0]
        note_slice = normalize_audio(y_other[:, first_note_start:first_note_start + int(sr*1.5)])
        save_sample(note_slice, sr, "surf_pluck_c4_sample")

    # 2. Isolated Analog Bass Single Note
    bass_sub = y_bass[0, int(sr*16):int(sr*20)]
    bass_onsets = librosa.onset.onset_detect(y=bass_sub, sr=sr, units='samples')
    if len(bass_onsets) > 0:
        b_start = int(sr*16) + bass_onsets[0]
        bass_note = normalize_audio(y_bass[:, b_start:b_start + int(sr*1.2)])
        save_sample(bass_note, sr, "analog_synth_bass_c2_sample")

    # 3. Synth Riser / Sweep (Transition sections in other.wav, e.g., sec 28-32)
    riser_start = int(sr * 27.5)
    riser_end = int(sr * 32.2)
    riser = normalize_audio(y_other[:, riser_start:riser_end])
    save_sample(riser, sr, "synth_riser_sweep_fx")

    # 4. Tape Drop / Ending Reverb Splash
    drop_start = int(sr * 48.0)
    drop_end = int(sr * 52.5)
    if y_other.shape[1] > drop_end:
        drop = normalize_audio(y_other[:, drop_start:drop_end])
        save_sample(drop, sr, "synth_tape_drop_fx")

    # 5. Kick Drum Impact Hit
    drum_sub = y_drums[0, int(sr*32):int(sr*36)]
    d_onsets = librosa.onset.onset_detect(y=drum_sub, sr=sr, units='samples')
    if len(d_onsets) > 0:
        k_start = int(sr*32) + d_onsets[0]
        kick_hit = normalize_audio(y_drums[:, k_start:k_start + int(sr*0.5)])
        save_sample(kick_hit, sr, "punchy_80s_kick_hit")

    print("All extra one-shots saved!")

if __name__ == "__main__":
    main()

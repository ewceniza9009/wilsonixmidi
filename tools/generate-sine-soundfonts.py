"""
Studio Pure Sine SoundFont Binary Pack Generator
Generates pristine 16-bit 44.1kHz stereo MP3 soundfont packs directly for NativePcmEngine.
Zero main-thread Web Audio node churning, zero lag, zero crackling, zero choking!
"""

import os
import sys
import math
import wave
import struct
import json
import tempfile
import subprocess

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_DIR = os.path.join(ROOT_DIR, "public", "soundfonts-bin")
FFMPEG = r"C:\Users\EWCEN\AppData\Roaming\npm\node_modules\ffmpeg-static\ffmpeg.exe"
SR = 44100

NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

def midi_to_note_name(midi):
    octave = (midi // 12) - 1
    return f"{NOTE_NAMES[midi % 12]}{octave}"

def midi_to_freq(midi):
    return 440.0 * math.pow(2.0, (midi - 69) / 12.0)

def generate_sine_wave(inst_type, freq, duration_sec=2.5):
    total_frames = int(SR * duration_sec)
    samples_l = [0.0] * total_frames
    samples_r = [0.0] * total_frames
    
    # Envelope parameters
    if inst_type == "sub":
        attack_sec = 0.005
        decay_sec = 0.4
        sustain_level = 0.70
        rel_start_sec = duration_sec - 0.20
    elif inst_type == "keys":
        attack_sec = 0.004
        decay_sec = 0.8
        sustain_level = 0.35
        rel_start_sec = duration_sec - 0.25
    elif inst_type == "bells":
        attack_sec = 0.003
        decay_sec = 1.2
        sustain_level = 0.15
        rel_start_sec = duration_sec - 0.35
    elif inst_type == "flute":
        attack_sec = 0.05
        decay_sec = 0.6
        sustain_level = 0.80
        rel_start_sec = duration_sec - 0.20
    elif inst_type == "pad":
        attack_sec = 0.35
        decay_sec = 0.8
        sustain_level = 0.85
        rel_start_sec = duration_sec - 0.40
    else:  # lead
        attack_sec = 0.008
        decay_sec = 0.5
        sustain_level = 0.80
        rel_start_sec = duration_sec - 0.20

    attack_frames = int(attack_sec * SR)
    rel_start_frames = int(rel_start_sec * SR)
    
    for i in range(total_frames):
        t = i / SR
        
        # Amplitude envelope
        if i < attack_frames:
            # Raised cosine fade-in: perfectly click-free
            env = 0.5 * (1.0 - math.cos(math.pi * i / attack_frames))
        elif i < rel_start_frames:
            # Decay to sustain
            d_progress = (i - attack_frames) / max(1, (decay_sec * SR))
            env = 1.0 - (1.0 - sustain_level) * min(1.0, d_progress)
        else:
            # Raised cosine release to 0
            rel_progress = (i - rel_start_frames) / max(1, (total_frames - rel_start_frames))
            env = sustain_level * 0.5 * (1.0 + math.cos(math.pi * min(1.0, rel_progress)))

        # Wave synthesis
        if inst_type == "sub":
            # Pure deep sine fundamental + subtle 2nd harmonic warmth
            s = math.sin(2.0 * math.pi * freq * t) * 0.90 + math.sin(2.0 * math.pi * freq * 2.0 * t) * 0.10
            samples_l[i] = s * env
            samples_r[i] = s * env
        elif inst_type == "keys":
            # Mellow electric sine: fundamental + 3rd harmonic partial
            s = math.sin(2.0 * math.pi * freq * t) * 0.82 + math.sin(2.0 * math.pi * freq * 3.0 * t) * 0.18
            samples_l[i] = s * env
            samples_r[i] = s * env
        elif inst_type == "bells":
            # Crystalline bells: fundamental + 4:1 partial + 7:1 partial
            s = math.sin(2.0 * math.pi * freq * t) * 0.70 + math.sin(2.0 * math.pi * freq * 4.0 * t) * 0.22 + math.sin(2.0 * math.pi * freq * 7.0 * t) * 0.08
            samples_l[i] = s * env
            samples_r[i] = s * env
        elif inst_type == "flute":
            # Singing sine flute: fundamental with gentle 5.2Hz vibrato
            vib = 1.0 + 0.003 * math.sin(2.0 * math.pi * 5.2 * t)
            s = math.sin(2.0 * math.pi * (freq * vib) * t) * 0.92 + math.sin(2.0 * math.pi * (freq * vib * 2.0) * t) * 0.08
            samples_l[i] = s * env
            samples_r[i] = s * env
        elif inst_type == "pad":
            # Lush wide stereo sine pad: gentle detune between Left and Right
            sl = math.sin(2.0 * math.pi * (freq * 0.9985) * t) * 0.85 + math.sin(2.0 * math.pi * (freq * 2.0 * 0.999) * t) * 0.15
            sr = math.sin(2.0 * math.pi * (freq * 1.0015) * t) * 0.85 + math.sin(2.0 * math.pi * (freq * 2.0 * 1.001) * t) * 0.15
            samples_l[i] = sl * env
            samples_r[i] = sr * env
        else:  # lead
            # Pure West Coast singing sine lead: pristine fundamental
            s = math.sin(2.0 * math.pi * freq * t) * 0.94 + math.sin(2.0 * math.pi * freq * 2.0 * t) * 0.06
            samples_l[i] = s * env
            samples_r[i] = s * env

    # Normalize to -0.5 dBFS
    max_peak = max(max(abs(x) for x in samples_l), max(abs(x) for x in samples_r))
    if max_peak > 0:
        scale = 30000.0 / max_peak
    else:
        scale = 30000.0

    raw_bytes = bytearray()
    for i in range(total_frames):
        val_l = max(-32768, min(32767, int(samples_l[i] * scale)))
        val_r = max(-32768, min(32767, int(samples_r[i] * scale)))
        raw_bytes.extend(struct.pack("<hh", val_l, val_r))

    return bytes(raw_bytes)

def encode_wav_to_mp3(wav_path, mp3_path):
    cmd = [
        FFMPEG, "-y",
        "-f", "s16le", "-ar", str(SR), "-ac", "2",
        "-i", wav_path,
        "-b:a", "320k",
        "-f", "mp3",
        mp3_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

INSTRUMENTS = [
    {
        "id": "pure_sine_lead",
        "type": "lead",
        "midis": [24, 31, 36, 43, 48, 55, 60, 67, 72, 79, 84, 91, 96, 103, 108]
    },
    {
        "id": "pure_sine_sub",
        "type": "sub",
        "midis": [21, 24, 28, 31, 36, 40, 43, 48, 55, 60, 67, 72]
    },
    {
        "id": "warm_sine_keys",
        "type": "keys",
        "midis": [24, 31, 36, 43, 48, 55, 60, 67, 72, 79, 84, 91, 96, 103, 108]
    },
    {
        "id": "crystal_sine_bells",
        "type": "bells",
        "midis": [36, 48, 60, 72, 84, 96, 108]
    },
    {
        "id": "cosmic_sine_flute",
        "type": "flute",
        "midis": [36, 43, 48, 55, 60, 67, 72, 79, 84, 91, 96, 108]
    },
    {
        "id": "deep_sine_pad",
        "type": "pad",
        "midis": [24, 31, 36, 43, 48, 55, 60, 67, 72, 79, 84, 91, 96, 108]
    }
]

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp_dir:
        for inst in INSTRUMENTS:
            inst_id = inst["id"]
            inst_type = inst["type"]
            midis = inst["midis"]
            print(f"Generating studio soundfont pack: {inst_id} ({inst_type})...")
            
            samples_info = []
            pack_bytes = bytearray()
            current_offset = 0
            
            for m in midis:
                freq = midi_to_freq(m)
                note_name = midi_to_note_name(m)
                raw_pcm = generate_sine_wave(inst_type, freq)
                
                raw_path = os.path.join(tmp_dir, f"{inst_id}_{m}.pcm")
                mp3_path = os.path.join(tmp_dir, f"{inst_id}_{m}.mp3")
                
                with open(raw_path, "wb") as f:
                    f.write(raw_pcm)
                
                encode_wav_to_mp3(raw_path, mp3_path)
                
                with open(mp3_path, "rb") as f:
                    mp3_data = f.read()
                
                length = len(mp3_data)
                samples_info.append({
                    "n": note_name,
                    "m": m,
                    "o": current_offset,
                    "l": length
                })
                pack_bytes.extend(mp3_data)
                current_offset += length
            
            # Write manifest JSON
            manifest = {
                "id": inst_id,
                "count": len(samples_info),
                "totalBytes": len(pack_bytes),
                "samples": samples_info
            }
            json_path = os.path.join(OUT_DIR, f"{inst_id}.json")
            pack_path = os.path.join(OUT_DIR, f"{inst_id}.pack")
            
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(manifest, f)
            with open(pack_path, "wb") as f:
                f.write(pack_bytes)
            
            print(f"  -> Created {json_path} and {pack_path} ({len(pack_bytes)} bytes)")

if __name__ == "__main__":
    main()

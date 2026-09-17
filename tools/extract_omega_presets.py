"""
OmegaGMGS2.sf2 Premium Extraction Pipeline
Extracts 12 elite presets and appends them to yamaha-eos-pcm-data.js
"""
import os
import io
import soundfile as sf
import numpy as np
import base64
import subprocess
from sf2utils.sf2parse import Sf2File

omega_path = r'C:\Users\EWCEN\Downloads\OmegaGMGS2.sf2'
out_file = r'x:\midikey\src\audio\yamaha-eos-pcm-data.js'
scratch_dir = r'x:\midikey\scratch'
os.makedirs(scratch_dir, exist_ok=True)

print("Loading OmegaGMGS2.sf2...")
omega_f = open(omega_path, 'rb')
omega = Sf2File(omega_f)
print(f"Loaded {len(omega.samples)} samples, {len(omega.presets)} presets")

def render_sample_to_b64(sample, duration_sec=6.5, is_synth=False):
    buf = io.BytesIO()
    sample.export(buf)
    buf.seek(0)
    data, sr = sf.read(buf)
    if data.ndim > 1:
        data = data[:, 0]

    loop_start = sample.start_loop
    loop_end = sample.end_loop
    has_loop = loop_end > loop_start and loop_end <= len(data) and (loop_end - loop_start) > 40

    if has_loop:
        attack = data[:loop_start]
        loop_chunk = data[loop_start:loop_end]
        target_len = int(sr * duration_sec)
        reps = int(np.ceil((target_len - len(attack)) / len(loop_chunk))) + 2
        looped = np.tile(loop_chunk, reps)
        full = np.concatenate([attack, looped])[:target_len]

        fade_len = int(sr * 0.35)
        fade = 0.5 * (1 + np.cos(np.linspace(0, np.pi, fade_len)))
        full[-fade_len:] *= fade
    else:
        target_len = min(len(data), int(sr * duration_sec))
        full = data[:target_len].copy()

    if not is_synth:
        t = np.linspace(0, len(full) / sr, len(full))
        env = np.exp(-t * 0.22)
        full = full * env

    m = np.max(np.abs(full))
    if m > 0:
        full = full * (0.95 / m)

    tmp_wav = os.path.join(scratch_dir, "temp_render.wav")
    tmp_mp3 = os.path.join(scratch_dir, "temp_render.mp3")
    sf.write(tmp_wav, full, sr, subtype='PCM_16')
    cmd = ['ffmpeg', '-y', '-i', tmp_wav, '-b:a', '192k', tmp_mp3]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    with open(tmp_mp3, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('utf-8')
    return f"data:audio/mp3;base64,{b64}"


def extract_preset_anchors(preset_name, bank_num, prog_num, is_synth=False, duration_sec=6.5):
    found = [p for p in omega.presets if hasattr(p, 'bank') and
             (p.name.strip().lower() == preset_name.strip().lower() or
              (p.bank == bank_num and p.preset == prog_num))]
    if not found:
        print(f"  ! Preset not found: {preset_name} [{bank_num}:{prog_num}]")
        return {}
    p = found[0]
    print(f"  Extracting [{p.bank:03d}:{p.preset:03d}] {p.name}")

    anchors = {}
    for bag in p.bags:
        if bag.instrument:
            for ibag in bag.instrument.bags:
                if ibag.sample and ibag.key_range:
                    kr = ibag.key_range
                    sample = ibag.sample
                    orig_pitch = sample.original_pitch or 60
                    target_key = min(max(orig_pitch, kr[0]), kr[1])
                    if str(target_key) not in anchors and len(sample.raw_sample_data) > 200:
                        try:
                            anchors[str(target_key)] = render_sample_to_b64(
                                sample, duration_sec=duration_sec, is_synth=is_synth)
                            print(f"    + Key {target_key}: {sample.name}")
                        except Exception as e:
                            print(f"    ! Error {sample.name}: {e}")
    return anchors


# ============================================================
# 12 Premium Elite Presets from OmegaGMGS2
# ============================================================

# 1. Pd:Fantasia — Shimmering ethereal motion pad
print("\n--- O01. Pd:Fantasia (Ethereal Motion Pad) ---")
fantasia_anchors = extract_preset_anchors('Fantasia 2', 1, 88, is_synth=True, duration_sec=7.5)

# 2. St:JP Strings — Roland JP-8000 lush supersaw strings
print("\n--- O02. St:JP Strings (JP-8000 Lush SuperSaw Strings) ---")
jp_strings_anchors = extract_preset_anchors('JP Strings', 3, 50, is_synth=True, duration_sec=7.5)

# 3. St:OB Strings — Oberheim OB-X analog string ensemble
print("\n--- O03. St:OB Strings (Oberheim OB-X Analog Strings) ---")
ob_strings_anchors = extract_preset_anchors('OB Strings', 1, 50, is_synth=True, duration_sec=7.5)

# 4. En:Euro Hit — Classic 90s Eurodance orchestral hit stab
print("\n--- O04. En:Euro Hit (90s Eurodance Orchestral Stab) ---")
euro_hit_anchors = extract_preset_anchors('Euro Hit', 3, 55, is_synth=False, duration_sec=3.0)

# 5. Ba:Acid Bass — Roland TB-303 acid squelch bass
print("\n--- O05. Ba:Acid Bass (TB-303 Acid Squelch Bass) ---")
acid_bass_anchors = extract_preset_anchors('Acid Bass', 24, 38, is_synth=True, duration_sec=5.5)

# 6. Gt:Funk Guitar — Wah-wah muted disco funk guitar
print("\n--- O06. Gt:Funk Guitar (Disco Wah-Wah Funk Guitar) ---")
funk_gtr_anchors = extract_preset_anchors('FunkGtr1', 40, 28, is_synth=False, duration_sec=4.5)

# 7. Pd:Silky Pad — Ultra-lush dreamy string cloud pad
print("\n--- O07. Pd:Silky Pad (Ultra-Lush Dreamy String Cloud) ---")
silky_pad_anchors = extract_preset_anchors('Silky Pad', 9, 103, is_synth=True, duration_sec=8.0)

# 8. En:Space Voice — Ethereal space choir synth vocal
print("\n--- O08. En:Space Voice (Ethereal Space Choir Synth Vocal) ---")
space_voice_anchors = extract_preset_anchors('Space Voice', 0, 91, is_synth=True, duration_sec=7.0)

# 9. Or:Rotary Organ — Fast rotary cabinet Hammond organ
print("\n--- O09. Or:Rotary Organ (Fast Leslie Rotary Hammond) ---")
rotary_organ_anchors = extract_preset_anchors('RotaryOr', 64, 18, is_synth=True, duration_sec=6.5)

# 10. Ld:MG Square — Moog-style square wave mono lead
print("\n--- O10. Ld:MG Square (Moog Square Mono Lead) ---")
mg_square_anchors = extract_preset_anchors('MG Square', 1, 80, is_synth=True, duration_sec=6.0)

# 11. St:Slow Strings — Slow attack cinematic orchestral strings
print("\n--- O11. St:Slow Strings (Cinematic Slow Attack Orchestra) ---")
slow_strings_anchors = extract_preset_anchors('Slow Strings', 0, 49, is_synth=True, duration_sec=7.5)

# 12. Br:Octave Brass — Massive octave-layered synth brass
print("\n--- O12. Br:Octave Brass (Massive Octave Synth Brass) ---")
oct_brass_anchors = extract_preset_anchors('Octave Brass', 24, 61, is_synth=True, duration_sec=6.0)


# ============================================================
# APPEND to existing yamaha-eos-pcm-data.js
# ============================================================
print(f"\nReading existing {out_file}...")
with open(out_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the last closing brace of the YAMAHA_EOS_PCM_BANKS object
# We need to insert new entries before the final `};`
insert_point = content.rfind('};')
if insert_point < 0:
    print("ERROR: Could not find closing `};` in yamaha-eos-pcm-data.js")
    exit(1)

new_banks = []

def write_bank(entries, inst_id, inst_name, anchors):
    if not anchors:
        print(f"  ! Skipping {inst_id} - no anchors")
        return
    lines = []
    lines.append(f'  "{inst_id}": {{')
    lines.append(f'    id: "{inst_id}",')
    lines.append(f'    name: "{inst_name}",')
    lines.append(f'    anchors: {{')
    for midi_key, b64 in anchors.items():
        lines.append(f'      "{midi_key}": "{b64}",')
    lines.append(f'    }}')
    lines.append(f'  }},')
    new_banks.append('\n'.join(lines))
    print(f"  + Written {inst_id}: {len(anchors)} anchors")

write_bank(new_banks, "eos_fantasia",    "Pd:Fantasia",      fantasia_anchors)
write_bank(new_banks, "eos_jp_strings",  "St:JP Strings",    jp_strings_anchors)
write_bank(new_banks, "eos_ob_strings",  "St:OB Strings",    ob_strings_anchors)
write_bank(new_banks, "eos_euro_hit",    "En:Euro Hit",      euro_hit_anchors)
write_bank(new_banks, "eos_acid_bass",   "Ba:Acid Bass",     acid_bass_anchors)
write_bank(new_banks, "eos_funk_gtr",    "Gt:Funk Guitar",   funk_gtr_anchors)
write_bank(new_banks, "eos_silky_pad",   "Pd:Silky Pad",     silky_pad_anchors)
write_bank(new_banks, "eos_space_voice", "En:Space Voice",   space_voice_anchors)
write_bank(new_banks, "eos_rotary_organ","Or:Rotary Organ",  rotary_organ_anchors)
write_bank(new_banks, "eos_mg_square",   "Ld:MG Square",     mg_square_anchors)
write_bank(new_banks, "eos_slow_strings","St:Slow Strings",  slow_strings_anchors)
write_bank(new_banks, "eos_oct_brass",   "Br:Octave Brass",  oct_brass_anchors)

# Insert before the final `};`
new_content = content[:insert_point] + '\n' + '\n'.join(new_banks) + '\n' + content[insert_point:]

print(f"\nWriting updated {out_file}...")
with open(out_file, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done! 12 new Omega premium presets appended to yamaha-eos-pcm-data.js")

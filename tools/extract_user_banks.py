"""
Pristine De-hissed Multi-Sample Extraction Pipeline for USER BANK B, C, D
Features:
- Equal-power sine/cosine crossfade on loop boundaries (0 clicks, 0 buzzing)
- Natural decay preservation for pianos, plucks, and slap bass (no artificial looping)
- Hardware-grade ffmpeg FFT denoiser (afftdn) to strip soundfont preamp/tape hiss
- Precision Butterworth lowpass filters tailored to instrument acoustic profiles
- Sub-rumble highpass cleanup at 25-35 Hz
- Pristine 192k encoding
"""
import os
import io
import json
import base64
import subprocess
import numpy as np
import soundfile as sf
from sf2utils.sf2parse import Sf2File

import tempfile
import uuid

scratch_dir = os.path.join(tempfile.gettempdir(), "midikey_scratch_clean")
out_js = r"x:\midikey\src\audio\user-bank-pcm-data.js"
os.makedirs(scratch_dir, exist_ok=True)

sf2_cache = {}

def get_sf2(path):
    if path not in sf2_cache:
        print(f"Loading {os.path.basename(path)}...")
        f = open(path, "rb")
        sf2_cache[path] = Sf2File(f)
    return sf2_cache[path]

def render_sample_to_b64(sample, duration_sec=5.0, is_synth=True, is_bass=False, is_organ=False):
    buf = io.BytesIO()
    sample.export(buf)
    buf.seek(0)
    data, sr = sf.read(buf)
    if data.ndim > 1:
        data = data[:, 0]

    loop_start = getattr(sample, "start_loop", 0)
    loop_end = getattr(sample, "end_loop", 0)
    loop_len = loop_end - loop_start
    can_loop = is_synth and loop_len > 200 and loop_end <= len(data) and loop_start >= 0

    if can_loop:
        attack = data[:loop_start]
        chunk = data[loop_start:loop_end]
        target_samples = int(sr * duration_sec)

        # Equal-power sine/cosine crossfade over 40ms or 20% of chunk
        xfade_len = min(len(chunk) // 5, int(sr * 0.04))
        if xfade_len < 32:
            xfade_len = min(len(chunk) // 2, 32)
        if xfade_len < 4:
            xfade_len = 4

        t_xf = np.linspace(0, np.pi / 2, xfade_len)
        gain_out = np.cos(t_xf)
        gain_in = np.sin(t_xf)

        if len(attack) < xfade_len:
            cur = chunk.copy()
        else:
            cur = attack.copy()
        while len(cur) < target_samples:
            overlap = cur[-xfade_len:] * gain_out + chunk[:xfade_len] * gain_in
            cur = np.concatenate([cur[:-xfade_len], overlap, chunk[xfade_len:]])

        full = cur[:target_samples].copy()

        # Smooth 0.3s fadeout at tail
        fade_len = int(sr * 0.3)
        fade = 0.5 * (1 + np.cos(np.linspace(0, np.pi, fade_len)))
        full[-fade_len:] *= fade
    else:
        if is_synth and len(data) < int(sr * 1.5):
            # Short synth wave without loop: crossfade repeat
            chunk = data
            target_samples = int(sr * duration_sec)
            xfade_len = min(len(chunk) // 4, int(sr * 0.03))
            if xfade_len < 8:
                xfade_len = max(len(chunk) // 2, 2)
            t_xf = np.linspace(0, np.pi / 2, xfade_len)
            gain_out = np.cos(t_xf)
            gain_in = np.sin(t_xf)
            cur = chunk.copy()
            while len(cur) < target_samples:
                overlap = cur[-xfade_len:] * gain_out + chunk[:xfade_len] * gain_in
                cur = np.concatenate([cur[:-xfade_len], overlap, chunk[xfade_len:]])
            full = cur[:target_samples].copy()
            fade_len = int(sr * 0.3)
            fade = 0.5 * (1 + np.cos(np.linspace(0, np.pi, fade_len)))
            full[-fade_len:] *= fade
        else:
            # Natural decay instrument (pianos, slap bass, plucks)
            target_samples = min(len(data), int(sr * duration_sec))
            full = data[:target_samples].copy()
            decay_env = np.exp(-np.linspace(0, 2.2, len(full)))
            full = full * decay_env
            fade_len = int(min(sr * 0.3, len(full) * 0.2))
            fade = 0.5 * (1 + np.cos(np.linspace(0, np.pi, fade_len)))
            full[-fade_len:] *= fade

    peak = np.max(np.abs(full))
    if peak > 0.001:
        full = full * (0.90 / peak)

    uid = uuid.uuid4().hex
    tmp_wav = os.path.join(scratch_dir, f"temp_{uid}.wav")
    tmp_mp3 = os.path.join(scratch_dir, f"temp_{uid}.mp3")
    try:
        sf.write(tmp_wav, full, sr, subtype="PCM_16")

        # High-quality FFT denoise & surgical lowpass
        if is_bass:
            af = "highpass=f=25,lowpass=f=8000,afftdn=nr=18:nf=-45:tn=1"
        elif is_organ:
            af = "highpass=f=35,lowpass=f=11000,afftdn=nr=15:nf=-48:tn=1"
        else:
            af = "highpass=f=30,lowpass=f=13500,afftdn=nr=14:nf=-48:tn=1"

        cmd = ["ffmpeg", "-y", "-i", tmp_wav, "-af", af, "-b:a", "192k", tmp_mp3]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        with open(tmp_mp3, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
        return f"data:audio/mp3;base64,{b64}"
    finally:
        for p in (tmp_wav, tmp_mp3):
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass


def extract_preset(sf_path, bank_num, preset_num, name_hint="", is_synth=True, is_bass=False, is_organ=False, duration_sec=5.0, max_anchors=5):
    sf2 = get_sf2(sf_path)
    found = [p for p in sf2.presets if hasattr(p, "bank") and p.bank == bank_num and p.preset == preset_num]
    if not found and name_hint:
        found = [p for p in sf2.presets if hasattr(p, "bank") and name_hint.lower() in p.name.lower()]
    if not found:
        print(f"  [!] NOT FOUND: [{bank_num}:{preset_num}] '{name_hint}' in {os.path.basename(sf_path)}")
        return {}

    preset = found[0]
    print(f"  Extracting [{preset.bank:3d}:{preset.preset:3d}] '{preset.name}' from {os.path.basename(sf_path)}")

    candidates = []
    for bag in preset.bags:
        if bag.sample:
            pitch = getattr(bag.sample, "original_pitch", 60) or 60
            candidates.append((pitch, bag.sample))
        if bag.instrument:
            for ib in bag.instrument.bags:
                if ib.sample:
                    kr = ib.key_range
                    pitch = getattr(ib.sample, "original_pitch", 60) or 60
                    target_key = pitch
                    if kr:
                        target_key = min(max(pitch, kr[0]), kr[1])
                    candidates.append((target_key, ib.sample))

    if not candidates:
        print(f"    No samples found in preset '{preset.name}'")
        return {}

    unique_by_key = {}
    for key, sample in candidates:
        if len(sample.raw_sample_data) < 200:
            continue
        if key not in unique_by_key:
            unique_by_key[key] = sample
        elif getattr(sample, "is_left", True):
            unique_by_key[key] = sample

    sorted_keys = sorted(unique_by_key.keys())
    if len(sorted_keys) > max_anchors:
        indices = np.linspace(0, len(sorted_keys) - 1, max_anchors, dtype=int)
        selected_keys = [sorted_keys[i] for i in set(indices)]
    else:
        selected_keys = sorted_keys

    anchors = {}
    for key in selected_keys:
        sample = unique_by_key[key]
        try:
            b64 = render_sample_to_b64(
                sample,
                duration_sec=duration_sec,
                is_synth=is_synth,
                is_bass=is_bass,
                is_organ=is_organ
            )
            anchors[str(key)] = b64
            print(f"    + Key {key:3d}: {sample.name} [CLEAN]")
        except Exception as e:
            print(f"    ! Error rendering key {key} ({sample.name}): {e}")

    return anchors


PRESETS_TO_EXTRACT = [
    # --- USER BANK B: House & Garage Classics ---
    {
        "id": "edm_house_piano",
        "name": "90s House Piano",
        "sf_path": r"C:\Users\EWCEN\Downloads\Live_Party_SoundFont__Techno_.sf2",
        "bank": 2, "preset": 2, "hint": "Dance Piano 6",
        "is_synth": False, "is_bass": False, "is_organ": False, "duration": 4.5, "max_anchors": 5
    },
    {
        "id": "korg_techno_organ",
        "name": "Techno Rock Organ",
        "sf_path": r"C:\Users\EWCEN\Downloads\Korg_TRITON_Techno_Rock_Organ_Soundfont.sf2",
        "bank": 0, "preset": 18, "hint": "Techno Rock Organ",
        "is_synth": True, "is_bass": False, "is_organ": True, "duration": 5.5, "max_anchors": 3
    },
    {
        "id": "edm_river_bass1",
        "name": "River House Bass 1",
        "sf_path": r"C:\Users\EWCEN\Downloads\Live_Party_SoundFont__Techno_.sf2",
        "bank": 1, "preset": 38, "hint": "River Bass 1",
        "is_synth": True, "is_bass": True, "is_organ": False, "duration": 4.0, "max_anchors": 4
    },
    {
        "id": "edm_dx_funkbass",
        "name": "DX FunkBass",
        "sf_path": r"C:\Users\EWCEN\Downloads\RetroFont2026.sf2",
        "bank": 0, "preset": 37, "hint": "DX FunkBass",
        "is_synth": False, "is_bass": True, "is_organ": False, "duration": 3.8, "max_anchors": 2
    },
    {
        "id": "edm_club_saw1",
        "name": "Club Saw Lead 1",
        "sf_path": r"C:\Users\EWCEN\Downloads\Live_Party_SoundFont__Techno_.sf2",
        "bank": 5, "preset": 81, "hint": "Club Saw 1",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 5.5, "max_anchors": 5
    },
    {
        "id": "edm_club_brass",
        "name": "Club Brass Lead",
        "sf_path": r"C:\Users\EWCEN\Downloads\Live_Party_SoundFont__Techno_.sf2",
        "bank": 0, "preset": 62, "hint": "Club Brass Lead",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 5.0, "max_anchors": 5
    },
    {
        "id": "edm_hiq_bass",
        "name": "HiQ Deep Bass",
        "sf_path": r"C:\Users\EWCEN\Downloads\RetroFont2026.sf2",
        "bank": 0, "preset": 39, "hint": "HiQ Bass",
        "is_synth": False, "is_bass": True, "is_organ": False, "duration": 3.8, "max_anchors": 2
    },
    {
        "id": "edm_mika_piano",
        "name": "Mika Dance Piano",
        "sf_path": r"C:\Users\EWCEN\Downloads\Live_Party_SoundFont__Techno_.sf2",
        "bank": 0, "preset": 0, "hint": "Mika Dance Piano",
        "is_synth": False, "is_bass": False, "is_organ": False, "duration": 5.0, "max_anchors": 5
    },
    {
        "id": "edm_river_bass2",
        "name": "River Sub Bass 2",
        "sf_path": r"C:\Users\EWCEN\Downloads\Live_Party_SoundFont__Techno_.sf2",
        "bank": 1, "preset": 39, "hint": "River Bass 2",
        "is_synth": True, "is_bass": True, "is_organ": False, "duration": 4.0, "max_anchors": 4
    },

    # --- USER BANK C: EDM & Festival Anthems ---
    {
        "id": "edm_iconic_lead1",
        "name": "Iconic EDM Lead 1",
        "sf_path": r"C:\Users\EWCEN\Downloads\Iconic_EDM_Leads.sf2",
        "bank": 0, "preset": 0, "hint": "Iconic EDM Lead 1",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 5.0, "max_anchors": 2
    },
    {
        "id": "edm_iconic_lead2",
        "name": "Iconic EDM Lead 2",
        "sf_path": r"C:\Users\EWCEN\Downloads\Iconic_EDM_Leads.sf2",
        "bank": 0, "preset": 1, "hint": "Iconic EDM Lead 2",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 5.0, "max_anchors": 2
    },
    {
        "id": "edm_supersaw_jp80",
        "name": "SuperSaw JP-80",
        "sf_path": r"C:\Users\EWCEN\Downloads\Live_Party_SoundFont__Techno_.sf2",
        "bank": 8, "preset": 81, "hint": "Club Saw 4",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 6.0, "max_anchors": 5
    },
    {
        "id": "edm_bigroom_saw",
        "name": "Big Room Saw",
        "sf_path": r"C:\Users\EWCEN\Downloads\Live_Party_SoundFont__Techno_.sf2",
        "bank": 7, "preset": 81, "hint": "Club Saw 3",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 5.5, "max_anchors": 5
    },
    {
        "id": "edm_trance_oct",
        "name": "Trance Synth Oct",
        "sf_path": r"C:\Users\EWCEN\Downloads\Live_Party_SoundFont__Techno_.sf2",
        "bank": 3, "preset": 81, "hint": "Trance Synth Oct",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 5.5, "max_anchors": 2
    },
    {
        "id": "edm_retro_synthbass1",
        "name": "Punch Synth Bass",
        "sf_path": r"C:\Users\EWCEN\Downloads\RetroFont2026.sf2",
        "bank": 0, "preset": 38, "hint": "Synth Bass 1",
        "is_synth": False, "is_bass": True, "is_organ": False, "duration": 4.0, "max_anchors": 2
    },
    {
        "id": "edm_k2500_oohs",
        "name": "K2500 Voice Oohs",
        "sf_path": r"C:\Users\EWCEN\Downloads\Live_Party_SoundFont__Techno_.sf2",
        "bank": 0, "preset": 53, "hint": "Voice Oohs",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 6.5, "max_anchors": 5
    },
    {
        "id": "edm_gus_voice",
        "name": "GUS Synth Voice",
        "sf_path": r"C:\Users\EWCEN\Downloads\Live_Party_SoundFont__Techno_.sf2",
        "bank": 0, "preset": 54, "hint": "Synth Voice",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 5.5, "max_anchors": 5
    },

    # --- USER BANK D: Techno, Trance & Underground ---
    {
        "id": "edm_warehouse_saw",
        "name": "Techno Warehouse Saw",
        "sf_path": r"C:\Users\EWCEN\Downloads\Live_Party_SoundFont__Techno_.sf2",
        "bank": 1, "preset": 81, "hint": "Saw Wave 2",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 5.5, "max_anchors": 5
    },
    {
        "id": "edm_trance_synth",
        "name": "Euro Trance Synth",
        "sf_path": r"C:\Users\EWCEN\Downloads\Live_Party_SoundFont__Techno_.sf2",
        "bank": 2, "preset": 81, "hint": "Trance Synth",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 5.5, "max_anchors": 2
    },
    {
        "id": "edm_berlin_sub",
        "name": "Berlin Sub Bass",
        "sf_path": r"C:\Users\EWCEN\Downloads\Live_Party_SoundFont__Techno_.sf2",
        "bank": 0, "preset": 39, "hint": "Synth Bass 2",
        "is_synth": True, "is_bass": True, "is_organ": False, "duration": 4.5, "max_anchors": 4
    },
    {
        "id": "edm_club_saw2",
        "name": "Detuned Club Saw 2",
        "sf_path": r"C:\Users\EWCEN\Downloads\Live_Party_SoundFont__Techno_.sf2",
        "bank": 6, "preset": 81, "hint": "Club Saw 2",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 5.5, "max_anchors": 4
    },
    {
        "id": "edm_trance_oct2",
        "name": "Trance Synth Oct2",
        "sf_path": r"C:\Users\EWCEN\Downloads\Live_Party_SoundFont__Techno_.sf2",
        "bank": 4, "preset": 81, "hint": "Trance Synth Oct2",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 5.5, "max_anchors": 2
    },
    {
        "id": "omega_saw_gs",
        "name": "Saw Wave GS",
        "sf_path": r"C:\Users\EWCEN\Downloads\OmegaGMGS2.sf2",
        "bank": 18, "preset": 81, "hint": "Dynamic Saw",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 5.5, "max_anchors": 4
    },
    {
        "id": "omega_doctor_solo",
        "name": "Doctor Solo Lead",
        "sf_path": r"C:\Users\EWCEN\Downloads\OmegaGMGS2.sf2",
        "bank": 8, "preset": 80, "hint": "Doctor Solo",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 5.5, "max_anchors": 4
    },

    # --- USER BANK E: Studio Rompler & GM2 Elite (Jnsgm2.sf2) ---
    {
        "id": "jns_rhodes",
        "name": "Vintage Mark I Rhodes",
        "sf_path": r"C:\Users\EWCEN\Downloads\Jnsgm2.sf2",
        "bank": 0, "preset": 4, "hint": "Rhodes Piano",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 5.0, "max_anchors": 5
    },
    {
        "id": "jns_hammond",
        "name": "Gospel Hammond B3",
        "sf_path": r"C:\Users\EWCEN\Downloads\Jnsgm2.sf2",
        "bank": 0, "preset": 16, "hint": "Hammond Organ",
        "is_synth": True, "is_bass": False, "is_organ": True, "duration": 5.5, "max_anchors": 4
    },
    {
        "id": "jns_shakuhachi",
        "name": "Bamboo Shakuhachi Flute",
        "sf_path": r"C:\Users\EWCEN\Downloads\Jnsgm2.sf2",
        "bank": 0, "preset": 77, "hint": "Shakuhachi",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 5.5, "max_anchors": 3
    },
    {
        "id": "jns_fingered_bass",
        "name": "Classic Fingered Bass",
        "sf_path": r"C:\Users\EWCEN\Downloads\Jnsgm2.sf2",
        "bank": 0, "preset": 33, "hint": "Fingered Bass",
        "is_synth": False, "is_bass": True, "is_organ": False, "duration": 4.0, "max_anchors": 3
    },
    {
        "id": "jns_charang",
        "name": "Charang Screamer Lead",
        "sf_path": r"C:\Users\EWCEN\Downloads\Jnsgm2.sf2",
        "bank": 0, "preset": 84, "hint": "Charang",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 5.5, "max_anchors": 5
    },
    {
        "id": "jns_5th_saw",
        "name": "5th Power Saw Lead",
        "sf_path": r"C:\Users\EWCEN\Downloads\Jnsgm2.sf2",
        "bank": 0, "preset": 86, "hint": "5th Saw Wave",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 5.5, "max_anchors": 5
    },
    {
        "id": "jns_halo_pad",
        "name": "Ethereal Halo Pad",
        "sf_path": r"C:\Users\EWCEN\Downloads\Jnsgm2.sf2",
        "bank": 0, "preset": 94, "hint": "Halo Pad",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 6.0, "max_anchors": 5
    },
    {
        "id": "jns_bowed_glass",
        "name": "Bowed Crystal Glass",
        "sf_path": r"C:\Users\EWCEN\Downloads\Jnsgm2.sf2",
        "bank": 0, "preset": 92, "hint": "Bowed Glass",
        "is_synth": True, "is_bass": False, "is_organ": False, "duration": 6.0, "max_anchors": 5
    },
    {
        "id": "jns_sitar",
        "name": "Mystic Sitar & Drone",
        "sf_path": r"C:\Users\EWCEN\Downloads\Jnsgm2.sf2",
        "bank": 0, "preset": 104, "hint": "Sitar",
        "is_synth": False, "is_bass": False, "is_organ": False, "duration": 5.5, "max_anchors": 2
    },
]

if __name__ == "__main__":
    print(f"\nStarting extraction of {len(PRESETS_TO_EXTRACT)} presets with pristine de-hiss filtering...")
    pcm_banks = {}

    for pinfo in PRESETS_TO_EXTRACT:
        inst_id = pinfo["id"]
        anchors = extract_preset(
            pinfo["sf_path"],
            pinfo["bank"],
            pinfo["preset"],
            name_hint=pinfo.get("hint", ""),
            is_synth=pinfo.get("is_synth", True),
            is_bass=pinfo.get("is_bass", False),
            is_organ=pinfo.get("is_organ", False),
            duration_sec=pinfo.get("duration", 5.0),
            max_anchors=pinfo.get("max_anchors", 5)
        )
        if anchors:
            pcm_banks[inst_id] = {
                "id": inst_id,
                "name": pinfo["name"],
                "anchors": anchors
            }
            print(f"  [OK] {inst_id}: {len(anchors)} clean anchors extracted.")
        else:
            print(f"  [FAIL] Could not extract {inst_id}!")

    print(f"\nSuccessfully extracted {len(pcm_banks)} clean instrument soundbanks.")

    print(f"Writing to {out_js}...")
    with open(out_js, "w", encoding="utf-8") as f:
        f.write("// USER BANK B, C, D Multi-Sample Data (Cleaned & De-hissed)\n")
        f.write("export const USER_BANK_PCM_BANKS = {\n")
        for inst_id, bank in pcm_banks.items():
            f.write(f'  "{inst_id}": {{\n')
            f.write(f'    id: "{bank["id"]}",\n')
            f.write(f'    name: "{bank["name"]}",\n')
            f.write('    anchors: {\n')
            for midi_str, b64 in bank["anchors"].items():
                f.write(f'      "{midi_str}": "{b64}",\n')
            f.write('    }\n')
            f.write('  },\n')
        f.write("};\n")

    # Cleanup scratch_clean
    try:
        for fname in os.listdir(scratch_dir):
            os.remove(os.path.join(scratch_dir, fname))
        os.rmdir(scratch_dir)
    except Exception:
        pass

    file_size = os.path.getsize(out_js)
    print(f"Finished! File size: {file_size / (1024 * 1024):.2f} MB")

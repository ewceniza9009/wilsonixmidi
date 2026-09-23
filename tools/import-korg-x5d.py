"""
Korg X5-D SoundFont High-Fidelity Stereo Ingest Pipeline
Converts genuine NorCtrack Korg X5-D SoundFont2 (.sf2) files into true stereo binary soundfont packs.
Features:
  1. True Stereo Interleaving: pairs pan -500 (Left) and pan +500 (Right) layers.
  2. Attack Preservation: gentle 6ms raised-cosine fade-in to prevent DC pop while keeping punch.
  3. Loop Body Preservation: prevents destructive fade-out on sustained/looping sounds.
  4. Peak Headroom Punch: normalized to -0.3 dBFS (~31,500) for maximum presence & punch.
  5. Studio Bitrate: 320 kbps stereo MP3 via libmp3lame with zero muffled grain.
"""

import os
import sys
import re
import glob
import json
import array
import math
import subprocess
import shutil

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SF2_DIR = r"C:\Users\EWCEN\Downloads\Korg X5-D"
OUT_DIR = os.path.join(ROOT_DIR, "public", "soundfonts-bin")

NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

def midi_to_note_name(midi):
    octave = (midi // 12) - 1
    note = NOTE_NAMES[midi % 12]
    return f"{note}{octave}"

def slugify(text):
    text = text.lower()
    text = re.sub(r'[\+\s\-]+', '_', text)
    text = re.sub(r'[^a-z0-9_]', '', text)
    return text.strip('_')

def find_subchunk(parent_bytes, tag):
    idx = 0
    p_len = len(parent_bytes)
    while idx < p_len - 8:
        cid = parent_bytes[idx:idx+4]
        csize = int.from_bytes(parent_bytes[idx+4:idx+8], 'little')
        if cid == tag:
            return parent_bytes[idx+8:idx+8+csize]
        idx += 8 + csize
    return None

def parse_sf2(sf2_path):
    with open(sf2_path, "rb") as f:
        data = f.read()

    idx = 12
    pdta_data = None
    sdta_pos = 0
    d_len = len(data)
    while idx < d_len - 8:
        cid = data[idx:idx+4]
        csize = int.from_bytes(data[idx+4:idx+8], 'little')
        if cid == b'LIST':
            ltype = data[idx+8:idx+12]
            if ltype == b'pdta':
                pdta_data = data[idx+12:idx+8+csize]
            elif ltype == b'sdta':
                smpl_idx = idx + 12
                end_sdta = idx + 8 + csize
                while smpl_idx < end_sdta:
                    scid = data[smpl_idx:smpl_idx+4]
                    scsize = int.from_bytes(data[smpl_idx+4:smpl_idx+8], 'little')
                    if scid == b'smpl':
                        sdta_pos = smpl_idx + 8
                        break
                    smpl_idx += 8 + scsize
        idx += 8 + csize

    if not pdta_data or sdta_pos == 0:
        raise ValueError("Could not find pdta or smpl chunk in SF2")

    phdr_bytes = find_subchunk(pdta_data, b'phdr')
    pbag_bytes = find_subchunk(pdta_data, b'pbag')
    pgen_bytes = find_subchunk(pdta_data, b'pgen')
    inst_bytes = find_subchunk(pdta_data, b'inst')
    ibag_bytes = find_subchunk(pdta_data, b'ibag')
    igen_bytes = find_subchunk(pdta_data, b'igen')
    shdr_bytes = find_subchunk(pdta_data, b'shdr')

    import struct
    def parse_records(b, size, fmt):
        n = len(b) // size
        return [struct.unpack(fmt, b[i*size:(i+1)*size]) for i in range(n)]

    phdrs = []
    for i in range(len(phdr_bytes) // 38):
        rec = phdr_bytes[i*38:(i+1)*38]
        name = rec[:20].decode('latin1', errors='ignore').strip('\x00')
        preset, bank, bag, lib, genre, morph = struct.unpack('<HHHIII', rec[20:38])
        phdrs.append({'name': name, 'preset': preset, 'bank': bank, 'bag': bag})

    pbags = parse_records(pbag_bytes, 4, '<HH')
    pgens = parse_records(pgen_bytes, 4, '<Hh')

    insts = []
    for i in range(len(inst_bytes) // 22):
        rec = inst_bytes[i*22:(i+1)*22]
        name = rec[:20].decode('latin1', errors='ignore').strip('\x00')
        bag = struct.unpack('<H', rec[20:22])[0]
        insts.append({'name': name, 'bag': bag})

    ibags = parse_records(ibag_bytes, 4, '<HH')
    igens = parse_records(igen_bytes, 4, '<Hh')

    shdrs = []
    for i in range(len(shdr_bytes) // 46):
        rec = shdr_bytes[i*46:(i+1)*46]
        sname = rec[:20].decode('latin1', errors='ignore').strip('\x00')
        start, end, startloop, endloop, srate, origpitch, pitchcorr, smplink, smptype = struct.unpack('<IIIIIBbHH', rec[20:46])
        shdrs.append({
            'name': sname, 'start': start, 'end': end,
            'startloop': startloop, 'endloop': endloop,
            'srate': srate, 'pitch': origpitch, 'pitchcorr': pitchcorr,
            'smplink': smplink, 'smptype': smptype
        })

    return {
        'data': data,
        'sdta_pos': sdta_pos,
        'phdrs': phdrs,
        'pbags': pbags,
        'pgens': pgens,
        'insts': insts,
        'ibags': ibags,
        'igens': igens,
        'shdrs': shdrs
    }

def get_preset_zones(sf, search_name):
    phdrs = sf['phdrs']
    pbags = sf['pbags']
    pgens = sf['pgens']
    insts = sf['insts']
    ibags = sf['ibags']
    igens = sf['igens']
    shdrs = sf['shdrs']

    zones = []
    for pi in range(len(phdrs) - 1):
        p = phdrs[pi]
        if search_name.lower() in p['name'].lower():
            bag_start = p['bag']
            bag_end = phdrs[pi+1]['bag']
            for bi in range(bag_start, bag_end):
                gen_start = pbags[bi][0]
                gen_end = pbags[bi+1][0] if bi+1 < len(pbags) else len(pgens)
                for gi in range(gen_start, gen_end):
                    oper, val = pgens[gi]
                    if oper == 41: # instrument
                        inst_idx = val
                        if inst_idx >= len(insts): continue
                        inst = insts[inst_idx]
                        ibag_start = inst['bag']
                        ibag_end = insts[inst_idx+1]['bag'] if inst_idx+1 < len(insts) else len(ibags)
                        for ibi in range(ibag_start, ibag_end):
                            igen_start = ibags[ibi][0]
                            igen_end = ibags[ibi+1][0] if ibi+1 < len(ibags) else len(igens)
                            key_range = (0, 127)
                            sample_id = None
                            root_key = None
                            pan = 0
                            for igi in range(igen_start, igen_end):
                                ioper, ival = igens[igi]
                                if ioper == 43: # keyRange
                                    low = ival & 0xFF
                                    high = (ival >> 8) & 0xFF
                                    key_range = (low, high)
                                elif ioper == 53: # sampleID
                                    sample_id = ival
                                elif ioper == 58: # overridingRootKey
                                    root_key = ival
                                elif ioper == 17: # pan
                                    pan = ival
                            if sample_id is not None and sample_id < len(shdrs):
                                smp = shdrs[sample_id]
                                pitch = root_key if root_key is not None else smp['pitch']
                                zones.append({
                                    'key_range': key_range,
                                    'sample_id': sample_id,
                                    'root_pitch': pitch,
                                    'smp': smp,
                                    'pan': pan
                                })
            break
    return zones

def clean_and_encode_stereo(pcm_samples, in_srate, in_channels, is_looped=False):
    """
    Studio-grade punch mastering:
    1. Short 6ms smooth raised-cosine fade-in to eliminate DC pops without dulling transients.
    2. Only apply end fade-out if NOT looped (preserving full sustain body & reverb tail).
    3. Punch Headroom Normalization: -0.3 dBFS (~31,500 / 32,768).
    4. Resample to 44.1 kHz 320k stereo MP3 for studio sparkle and punch.
    """
    samples = array.array('h', pcm_samples)
    n_frames = len(samples) // in_channels
    if n_frames == 0:
        return b""

    # 1. De-click Fade In (4ms - preserves punchy hammer/pluck transients)
    fade_in_len = min(int(in_srate * 0.004), n_frames // 8)
    if fade_in_len > 0:
        for i in range(fade_in_len):
            factor = 0.5 * (1.0 - math.cos(math.pi * i / fade_in_len))
            for c in range(in_channels):
                samples[i * in_channels + c] = int(round(samples[i * in_channels + c] * factor))

    # 2. Fade out ONLY if not looped to avoid killing sustain body
    if not is_looped:
        fade_out_len = min(int(in_srate * 0.020), n_frames // 8)
        if fade_out_len > 0:
            for i in range(fade_out_len):
                factor = 0.5 * (1.0 + math.cos(math.pi * i / fade_out_len))
                idx = n_frames - fade_out_len + i
                for c in range(in_channels):
                    samples[idx * in_channels + c] = int(round(samples[idx * in_channels + c] * factor))

    # 3. Punch Headroom Normalization (-0.3 dBFS ~ 31,500)
    max_val = max(abs(x) for x in samples) if len(samples) > 0 else 0
    if max_val > 0:
        target_peak = 31500.0
        scale = min(3.5, target_peak / max_val)
        if abs(scale - 1.0) > 0.01:
            for i in range(len(samples)):
                val = int(round(samples[i] * scale))
                samples[i] = max(-32767, min(32767, val))

    # 4. Clean encode via ffmpeg: 44.1kHz stereo 320k MP3 (Studio bit-rate)
    proc = subprocess.Popen(
        [
            "ffmpeg", "-v", "error", "-y",
            "-f", "s16le",
            "-ar", str(in_srate),
            "-ac", str(in_channels),
            "-i", "-",
            "-ar", "44100",
            "-ac", "2",
            "-c:a", "libmp3lame",
            "-b:a", "320k",
            "-q:a", "0",
            "-f", "mp3",
            "-"
        ],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    mp3_bytes, err = proc.communicate(input=samples.tobytes())
    return mp3_bytes

def extract_instrument_true_stereo(sf, inst_id, search_name):
    zones = get_preset_zones(sf, search_name)
    if not zones:
        return False

    data = sf['data']
    sdta_pos = sf['sdta_pos']

    pitch_groups = {}
    for z in zones:
        p = z['root_pitch']
        if p <= 0 or p > 127:
            p = (z['key_range'][0] + z['key_range'][1]) // 2
        p = max(21, min(108, p))
        if p not in pitch_groups:
            pitch_groups[p] = []
        pitch_groups[p].append(z)

    sorted_pitches = sorted(pitch_groups.keys())
    manifest_samples = []
    pack_data = bytearray()
    curr_offset = 0

    for pitch in sorted_pitches:
        group = pitch_groups[pitch]
        z_left = None
        z_right = None

        for z in group:
            pan = z.get('pan', 0)
            sname = z['smp']['name'].lower()
            if pan < 0 or 's_000_' in sname:
                if not z_left: z_left = z
            elif pan > 0 or 's_001_' in sname:
                if not z_right: z_right = z

        is_stereo = (z_left is not None and z_right is not None)
        is_looped = False

        if is_stereo:
            s_l = z_left['smp']
            s_r = z_right['smp']
            raw_l = data[sdta_pos + s_l['start']*2 : sdta_pos + s_l['end']*2]
            raw_r = data[sdta_pos + s_r['start']*2 : sdta_pos + s_r['end']*2]
            pcm_l = array.array('h', raw_l)
            pcm_r = array.array('h', raw_r)
            min_len = min(len(pcm_l), len(pcm_r))
            stereo_pcm = array.array('h', [0]) * (min_len * 2)
            stereo_pcm[0::2] = pcm_l[:min_len]
            stereo_pcm[1::2] = pcm_r[:min_len]
            is_looped = (s_l['startloop'] < s_l['endloop'] and s_l['endloop'] > s_l['start'])
            mp3_bytes = clean_and_encode_stereo(stereo_pcm.tobytes(), s_l['srate'], 2, is_looped)
        else:
            z_single = z_left or z_right or group[0]
            s = z_single['smp']
            pcm_bytes = data[sdta_pos + s['start']*2 : sdta_pos + s['end']*2]
            is_looped = (s['startloop'] < s['endloop'] and s['endloop'] > s['start'])
            mp3_bytes = clean_and_encode_stereo(pcm_bytes, s['srate'], 1, is_looped)

        if not mp3_bytes:
            continue

        n_name = midi_to_note_name(pitch)
        length = len(mp3_bytes)
        pack_data.extend(mp3_bytes)

        manifest_samples.append({
            "n": n_name,
            "m": pitch,
            "o": curr_offset,
            "l": length
        })
        curr_offset += length

    if not manifest_samples:
        return False

    pack_path = os.path.join(OUT_DIR, f"{inst_id}.pack")
    with open(pack_path, "wb") as f:
        f.write(pack_data)

    manifest_obj = {
        "id": inst_id,
        "count": len(manifest_samples),
        "totalBytes": len(pack_data),
        "samples": manifest_samples
    }
    json_path = os.path.join(OUT_DIR, f"{inst_id}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(manifest_obj, f, separators=(",", ":"))

    dist_dir = os.path.join(ROOT_DIR, "dist", "soundfonts-bin")
    if os.path.exists(dist_dir):
        shutil.copy2(pack_path, os.path.join(dist_dir, f"{inst_id}.pack"))
        shutil.copy2(json_path, os.path.join(dist_dir, f"{inst_id}.json"))

    return True

def process_single_sf2(fpath):
    try:
        base = os.path.splitext(os.path.basename(fpath))[0]
        slug = f"x5d_{slugify(base)}"
        sf = parse_sf2(fpath)
        p_names = [p['name'] for p in sf['phdrs'] if p['name'] != 'EOP']
        search_name = p_names[0] if p_names else base
        ok = extract_instrument_true_stereo(sf, slug, search_name)
        return (slug, ok, None)
    except Exception as ex:
        return (os.path.basename(fpath), False, str(ex))

def run():
    import concurrent.futures
    files = sorted(glob.glob(os.path.join(SF2_DIR, "*.sf2")))
    print(f"Re-extracting {len(files)} Korg X5D soundfonts with TRUE STEREO & 320k PUNCH across 6 workers...")

    success = 0
    total = len(files)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(process_single_sf2, f): f for f in files}
        for fut in concurrent.futures.as_completed(futures):
            slug, ok, err = fut.result()
            if ok:
                success += 1
                print(f"  [{success}/{total}] [OK] {slug} (True Stereo 320k)")
            else:
                print(f"  [FAIL] {slug} - Error: {err}")

    print(f"\nCompleted: {success}/{total} presets upgraded to pristine true stereo.")

if __name__ == "__main__":
    run()

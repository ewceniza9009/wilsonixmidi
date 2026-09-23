"""
Roland MV-30 & SC-55 SoundFont Ingest Pipeline
Extracts iconic Roland presets from SoundFont2 (.sf2) into binary soundfont packs:
  public/soundfonts-bin/<instId>.pack  (concatenated MP3 audio)
  public/soundfonts-bin/<instId>.json  (offset/length manifest)

Preserves stereo samples (Left + Right interleaving) and generates clean pitch anchors.
"""

import os
import sys
import struct
import subprocess
import json
import array
import math
import shutil

SF2_DEFAULT = r"C:\Users\EWCEN\Downloads\MV30__SC-55_Version_.sf2"
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_DIR = os.path.join(ROOT_DIR, "public", "soundfonts-bin")

NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

def midi_to_note_name(midi):
    octave = (midi // 12) - 1
    note = NOTE_NAMES[midi % 12]
    return f"{note}{octave}"

# The 10 Curated Roland Signature Instruments
ROLAND_INSTRUMENTS = [
    {
        "id": "roland_d50_fantasia",
        "name": "Roland D-50 Fantasia",
        "search": "Fantasia D50",
        "category": "Synth Pad",
    },
    {
        "id": "roland_u20_choir",
        "name": "Roland U-20 Airy Vocal Choir",
        "search": "u20 choir",
        "category": "Strings & Choir",
    },
    {
        "id": "roland_bright_ep",
        "name": "Roland SA Bright E.Piano",
        "search": "Bright EP 2",
        "category": "Electric Piano",
    },
    {
        "id": "roland_sc55_warm_pad",
        "name": "Roland SC-55 Warm Pad",
        "search": "Warm Pad",
        "category": "Synth Pad",
    },
    {
        "id": "roland_space_voice",
        "name": "Roland SC-55 Space Voice",
        "search": "Space Voice",
        "category": "Strings & Choir",
    },
    {
        "id": "roland_metal_pad",
        "name": "Roland MV-30 Shimmer Metal Pad",
        "search": "Roland Metal Pad",
        "category": "Synth Pad",
    },
    {
        "id": "roland_sc55_finger_bass",
        "name": "Roland SC-55 Punchy Finger Bass",
        "search": "SC-55 Fingerbass",
        "category": "Bass & Sub",
    },
    {
        "id": "roland_u20_shakuhachi",
        "name": "Roland U-20 Breathy Shakuhachi",
        "search": "U20 Shakuhachi",
        "category": "Woodwind",
    },
    {
        "id": "roland_orchestra_hit",
        "name": "Roland SC-55 Orchestra Hit",
        "search": "Orchestra Hit",
        "category": "Orchestral & Hit",
    },
    {
        "id": "roland_synth_brass",
        "name": "Roland Jupiter Synth Brass",
        "search": "Synth Brass1",
        "category": "Brass",
    },
]

def find_subchunk(parent_bytes, tag):
    idx = 0
    p_len = len(parent_bytes)
    while idx < p_len - 8:
        cid = parent_bytes[idx:idx+4]
        csize = struct.unpack('<I', parent_bytes[idx+4:idx+8])[0]
        if cid == tag:
            return parent_bytes[idx+8:idx+8+csize]
        idx += 8 + csize
    return None

def parse_sf2(sf2_path):
    print(f"Reading {sf2_path}...")
    with open(sf2_path, "rb") as f:
        data = f.read()

    idx = 12
    pdta_data = None
    sdta_pos = 0
    d_len = len(data)
    while idx < d_len - 8:
        cid = data[idx:idx+4]
        csize = struct.unpack('<I', data[idx+4:idx+8])[0]
        if cid == b'LIST':
            ltype = data[idx+8:idx+12]
            if ltype == b'pdta':
                pdta_data = data[idx+12:idx+8+csize]
            elif ltype == b'sdta':
                smpl_idx = idx + 12
                end_sdta = idx + 8 + csize
                while smpl_idx < end_sdta:
                    scid = data[smpl_idx:smpl_idx+4]
                    scsize = struct.unpack('<I', data[smpl_idx+4:smpl_idx+8])[0]
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

def clean_and_encode_pcm(pcm_samples, in_srate, in_channels):
    """
    Applies high-grade studio audio cleanup:
    1. 12ms smooth raised-cosine fade-in to eliminate note-onset DC pops & MDCT splatter.
    2. 50ms smooth raised-cosine fade-out to absolute 0.0 to eliminate end-of-sample edge clicks.
    3. Peak-headroom normalization to -2.0 dBFS (~26,000 / 32,768) to prevent combi clipping.
    4. Resamples cleanly to studio 44.1 kHz stereo with high-bitrate 256k MP3.
    """
    samples = array.array('h', pcm_samples)
    n_frames = len(samples) // in_channels
    if n_frames == 0:
        return b""

    fade_in_len = min(int(in_srate * 0.012), n_frames // 4)
    fade_out_len = min(int(in_srate * 0.050), n_frames // 4)

    # 1. De-click Fade In
    if fade_in_len > 0:
        for i in range(fade_in_len):
            factor = 0.5 * (1.0 - math.cos(math.pi * i / fade_in_len))
            for c in range(in_channels):
                samples[i * in_channels + c] = int(round(samples[i * in_channels + c] * factor))

    # 2. Smooth Fade Out to 0
    if fade_out_len > 0:
        for i in range(fade_out_len):
            factor = 0.5 * (1.0 + math.cos(math.pi * i / fade_out_len))
            idx = n_frames - fade_out_len + i
            for c in range(in_channels):
                samples[idx * in_channels + c] = int(round(samples[idx * in_channels + c] * factor))

    # 3. Peak Headroom Normalization (-2 dBFS ~ 26,000)
    max_val = max(abs(x) for x in samples) if len(samples) > 0 else 0
    if max_val > 0:
        target_peak = 26000.0
        scale = min(1.0, target_peak / max_val)
        if scale < 0.999:
            for i in range(len(samples)):
                samples[i] = int(round(samples[i] * scale))

    # 4. Clean encode via ffmpeg: resample to 44.1kHz stereo 256k MP3
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
            "-b:a", "256k",
            "-f", "mp3",
            "-"
        ],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    mp3_bytes, err = proc.communicate(input=samples.tobytes())
    if proc.returncode != 0:
        print(f"  ffmpeg error: {err.decode('utf-8', errors='ignore')}")
    return mp3_bytes

def extract_and_pack_instrument(sf, inst_def):
    inst_id = inst_def['id']
    search_name = inst_def['search']
    print(f"\n--- Processing {inst_def['name']} ({inst_id}) ---")

    zones = get_preset_zones(sf, search_name)
    if not zones:
        print(f"ERROR: No zones found for {search_name}")
        return False

    data = sf['data']
    sdta_pos = sf['sdta_pos']

    # Group zones by root_pitch (or key_range center if multi-sample has identical pitch)
    distinct_ranges = len(set(z['key_range'] for z in zones))
    distinct_pitches = len(set(z['root_pitch'] for z in zones))
    use_kr_center = (distinct_ranges > 1 and distinct_pitches == 1)

    pitch_groups = {}
    for z in zones:
        if use_kr_center:
            low, high = z['key_range']
            if low == 0 and high > 40:
                p = max(36, high - 8)
            elif high == 127 and low < 90:
                p = min(96, low + 8)
            else:
                p = (low + high) // 2
        else:
            p = z['root_pitch']
            if p <= 0 or p > 127:
                p = (z['key_range'][0] + z['key_range'][1]) // 2
        p = max(21, min(108, p))
        
        if p not in pitch_groups:
            pitch_groups[p] = []
        pitch_groups[p].append(z)

    sorted_pitches = sorted(pitch_groups.keys())
    print(f"Pitches detected: {sorted_pitches}")

    manifest_samples = []
    pack_data = bytearray()
    curr_offset = 0

    for pitch in sorted_pitches:
        group = pitch_groups[pitch]
        z_left = None
        z_right = None
        z_mono = None

        for z in group:
            st = z['smp']['smptype']
            sname = z['smp']['name'].lower()
            if st == 4 or sname.endswith('-l') or sname.endswith('l'):
                if not z_left: z_left = z
            elif st == 2 or sname.endswith('-r') or sname.endswith('r'):
                if not z_right: z_right = z
            else:
                if not z_mono: z_mono = z

        is_stereo = (z_left is not None and z_right is not None)
        if is_stereo:
            s_l = z_left['smp']
            s_r = z_right['smp']
            raw_l = data[sdta_pos + s_l['start']*2 : sdta_pos + s_l['end']*2]
            raw_r = data[sdta_pos + s_r['start']*2 : sdta_pos + s_r['end']*2]
            pcm_l = array.array('h', raw_l)
            pcm_r = array.array('h', raw_r)
            min_len = min(len(pcm_l), len(pcm_r))
            stereo_pcm = array.array('h')
            for i in range(min_len):
                stereo_pcm.append(pcm_l[i])
                stereo_pcm.append(pcm_r[i])
            mp3_bytes = clean_and_encode_pcm(stereo_pcm.tobytes(), s_l['srate'], 2)
        else:
            z_single = z_mono or z_left or z_right or group[0]
            s = z_single['smp']
            pcm_bytes = data[sdta_pos + s['start']*2 : sdta_pos + s['end']*2]
            mp3_bytes = clean_and_encode_pcm(pcm_bytes, s['srate'], 1)

        if not mp3_bytes:
            print(f"  Encoding error for pitch {pitch}")
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
        print(f"ERROR: No samples generated for {inst_id}")
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

    # Also sync to dist/soundfonts-bin if present
    dist_dir = os.path.join(ROOT_DIR, "dist", "soundfonts-bin")
    if os.path.exists(dist_dir):
        shutil.copy2(pack_path, os.path.join(dist_dir, f"{inst_id}.pack"))
        shutil.copy2(json_path, os.path.join(dist_dir, f"{inst_id}.json"))

    print(f"SUCCESS: {inst_id} -> {len(manifest_samples)} anchors, {len(pack_data):,} bytes")
    return True


def main():
    sf2_path = sys.argv[1] if len(sys.argv) > 1 else SF2_DEFAULT
    if not os.path.exists(sf2_path):
        print(f"File not found: {sf2_path}")
        sys.exit(1)

    os.makedirs(OUT_DIR, exist_ok=True)
    sf = parse_sf2(sf2_path)

    success_count = 0
    for inst in ROLAND_INSTRUMENTS:
        if extract_and_pack_instrument(sf, inst):
            success_count += 1

    print(f"\n==========================================")
    print(f"Completed: {success_count}/{len(ROLAND_INSTRUMENTS)} Roland instruments extracted into {OUT_DIR}")
    print(f"==========================================")

if __name__ == "__main__":
    main()

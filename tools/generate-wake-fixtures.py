"""Generate offline synthetic speech fixtures using an installed eSpeak NG library."""
import ctypes
import ctypes.util
import pathlib
import wave

library = ctypes.util.find_library('espeak-ng')
if not library:
    raise SystemExit('Install eSpeak NG to generate these synthetic fixtures, or supply recorded WAV files.')
speech = ctypes.CDLL(library)
chunks = []
callback_type = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)
@callback_type
def callback(samples, count, _events):
    if samples and count:
        chunks.append(ctypes.string_at(samples, count * 2))
    return 0
speech.espeak_Initialize.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_char_p, ctypes.c_int]
speech.espeak_SetSynthCallback.argtypes = [callback_type]
speech.espeak_SetVoiceByName.argtypes = [ctypes.c_char_p]
speech.espeak_Synth.argtypes = [ctypes.c_void_p, ctypes.c_size_t, ctypes.c_uint, ctypes.c_int, ctypes.c_uint, ctypes.c_uint, ctypes.POINTER(ctypes.c_uint), ctypes.c_void_p]
rate = speech.espeak_Initialize(2, 0, None, 0)
if rate <= 0:
    raise SystemExit('eSpeak NG could not initialize.')
speech.espeak_SetSynthCallback(callback)
speech.espeak_SetVoiceByName(b'en-us')
speech.espeak_SetParameter(1, 140, 0)
directory = pathlib.Path(__file__).resolve().parent.parent / 'artifacts' / 'wake-word'
directory.mkdir(parents=True, exist_ok=True)
phrases = {'wake': 'mirror mirror', 'stop': 'mirror stop', 'mute': 'mirror mute', 'near': 'near mirror', 'miracle': 'miracle miracle', 'weather': 'what is the weather today', 'story': 'Tell me a long story about a dragon.'}
for name, phrase in phrases.items():
    chunks.clear()
    text = phrase.encode('utf-8') + b'\0'
    identifier = ctypes.c_uint()
    if speech.espeak_Synth(text, len(text), 0, 1, 0, 1, ctypes.byref(identifier), None):
        raise SystemExit(f'Failed to synthesize {name}')
    speech.espeak_Synchronize()
    with wave.open(str(directory / f'{name}.wav'), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(rate)
        output.writeframes(b'\0' * (rate // 4 * 2) + b''.join(chunks) + b'\0' * (rate * 2))
    print(f'{name}: {phrase} ({rate}Hz)')
speech.espeak_Terminate()

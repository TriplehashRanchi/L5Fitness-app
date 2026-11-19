"""Makes the two water sounds for Home (needs numpy). Run: python3 make.py ../../assets/sounds
water-add.wav  - a quick pour: a few bubbly drops, played the moment water is added
water-fill.wav - a soft rising chime, played as the body fills up"""
import numpy as np, wave, sys
SR = 44100
out = sys.argv[1]
def save(name, x):
    x = x / max(1e-9, np.abs(x).max()) * 0.8
    fade = int(SR * 0.01); x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade)
    with wave.open(f'{out}/{name}', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype(np.int16).tobytes())

# a bubble: a short tone whose pitch sweeps up quickly, like air popping through water
def bubble(f0, f1, dur, amp=1.0):
    t = np.arange(int(SR * dur)) / SR
    f = f0 + (f1 - f0) * (t / dur) ** 0.6
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.exp(-t / (dur * 0.35)) * np.minimum(1, t / 0.004)
    return amp * np.sin(ph) * env

rng = np.random.default_rng(3)
n = int(SR * 0.75); add = np.zeros(n)
for i, start in enumerate([0.0, 0.085, 0.16, 0.22, 0.30, 0.37, 0.46]):
    f0 = rng.uniform(380, 620) * (1 + i * 0.05)
    b = bubble(f0, f0 * rng.uniform(1.7, 2.3), rng.uniform(0.07, 0.11), amp=1.0 - i * 0.09)
    a = int(start * SR); add[a:a + len(b)] += b[:n - a]
# a little splash of filtered noise under the first drops
noise = rng.standard_normal(n); noise = np.convolve(noise, np.ones(24) / 24, mode='same') - np.convolve(noise, np.ones(200) / 200, mode='same')
t = np.arange(n) / SR
add += noise * np.exp(-t / 0.12) * 0.25
save('water-add.wav', add)

# rising chime: three soft bell notes going up (C6, E6, G6), then a held C7 shimmer
def bell(f, dur, amp=1.0):
    t = np.arange(int(SR * dur)) / SR
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / 0.15) + 0.12 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t / 0.08)
    return amp * x * np.exp(-t / (dur * 0.3)) * np.minimum(1, t / 0.006)
n = int(SR * 1.3); fill = np.zeros(n)
for start, f, dur, amp in [(0.0, 1046.5, 0.5, 0.8), (0.13, 1318.5, 0.5, 0.85), (0.26, 1568.0, 0.6, 0.9), (0.42, 2093.0, 0.85, 0.7)]:
    b = bell(f, dur, amp); a = int(start * SR); fill[a:a + len(b)] += b[:n - a]
save('water-fill.wav', fill)

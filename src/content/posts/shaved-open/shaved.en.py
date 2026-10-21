# Open on the high / low: when the first RTH bar opens on its own high or low, does price come back to the open later?
# Input: cleaned 1-minute ES bars (Databento ES.c.0, timestamps in UTC)
import numpy as np
import pandas as pd

df = pd.read_csv("ES-1min_clean.csv", usecols=["ts_event", "open", "high", "low"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
m = t.dt.hour * 60 + t.dt.minute - 570                      # minutes since 09:30
rth = df[(m >= 0) & (m < 405)].assign(date=t.dt.normalize(), m=m)   # RTH 09:30–16:15

# A table with one row per day and 405 columns (one per minute); a minute with no trades is empty
H = rth.pivot(index="date", columns="m", values="high").reindex(columns=range(405)).values
L = rth.pivot(index="date", columns="m", values="low").reindex(columns=range(405)).values
op = rth.pivot(index="date", columns="m", values="open")[0].values   # open = the open of the 09:30 bar
day_hi, day_lo = np.nanmax(H, 1), np.nanmin(L, 1)
keep = (op == day_hi) | (op == day_lo)                      # the open is the day's high or low
print(f"Sample {len(op)} days; daily bar opens on its high {(op == day_hi).sum()} days, on its low {(op == day_lo).sum()} days, {100 * keep.mean():.2f}% in total")

for T in [1, 5, 15, 30, 60]:                                # different sizes for the first bar
    on_lo = op == np.nanmin(L[:, :T], 1)                    # opens on the low: open = the first bar's low (exactly equal)
    on_hi = op == np.nanmax(H[:, :T], 1)                    # opens on the high
    shaved = on_lo | on_hi
    # After the first bar closes, the first minute price trades back to the open (opened on the low: low ≤ open; opened on the high: high ≥ open)
    back = np.where(on_lo[:, None], L <= op[:, None], H >= op[:, None])
    back[:, :T] = False
    when = np.where(back.any(1), back.argmax(1), -1)[shaved]
    n = shaved.sum()
    print(f"First bar {T:2d} min: opens on its high or low {n} days ({100 * n / len(op):.2f}%, low {on_lo.sum()}, high {on_hi.sum()}); "
          f"back to the open that day {100 * (when >= 0).mean():.1f}%; open holds to the close {100 * keep[shaved].mean():.1f}%")
    if T == 5:
        for hhmm, mins in [("9:40", 10), ("10:00", 30), ("10:30", 60), ("11:30", 120)]:
            print(f"    Back to the open by {hhmm}: {100 * ((when >= 0) & (when < mins)).mean():.1f}%")
        med = int(np.median(when[when >= 0])) + 1           # median return time among days that came back (minutes after 09:30, at that minute's close)
        print(f"    Of the days that came back, half did so by {9 + (30 + med) // 60}:{(30 + med) % 60:02d}")

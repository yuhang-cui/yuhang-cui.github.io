# Follow-through after a relentless opening selloff: within the first 20 five-minute bars, a selloff where almost every bar
# is a bear bar and the highs step lower. Once it ends, is the rest of the day a trading range, a trend resumption or a reversal?
# Input: cleaned 1-minute ES bars (Databento ES.c.0, timestamps in UTC); output: printed stats and open-selloff.json (for the path chart)
import json
import warnings
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")                                # 99 minutes are missing; nanmax warns about All-NaN slices, which doesn't affect the results
df = pd.read_csv("ES-1min_clean.csv", usecols=["ts_event", "open", "high", "low", "close", "instrument_id"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
m = (t.dt.hour * 60 + t.dt.minute - 570).values                 # minutes since 09:30
keep = (m >= 0) & (m < 405)                                      # RTH 09:30–16:15
df, m, date = df[keep], m[keep], t[keep].dt.normalize().values
days, row = np.unique(date, return_inverse=True)
days = pd.DatetimeIndex(days)
nd = len(days)
M = {}
for k in ["open", "high", "low", "close"]:                       # one row per day, one column per minute; missing minutes are NaN
    a = np.full((nd, 405), np.nan)
    a[row, m] = df[k].values
    M[k] = a
inst = np.zeros(nd, dtype=int)
inst[row] = df.instrument_id.values                              # which contract the day traded; today and tomorrow must match when comparing them
C = pd.DataFrame(M["close"]).ffill(axis=1).values                # fill missing minutes with the previous minute's close
O = np.where(np.isnan(M["open"]), C, M["open"])
H, L = M["high"], M["low"]

NB = 81                                                          # 81 five-minute bars a day
bo = O[:, ::5]
bc = np.array([C[:, k * 5:(k + 1) * 5][:, -1] for k in range(NB)]).T
bh = np.array([np.nanmax(H[:, k * 5:(k + 1) * 5], 1) for k in range(NB)]).T
bl = np.array([np.nanmin(L[:, k * 5:(k + 1) * 5], 1) for k in range(NB)]).T
day_o, day_c, day_h, day_l = O[:, 0], C[:, -1], np.nanmax(H, 1), np.nanmin(L, 1)
rng = (day_h - day_l) / day_o * 100
rng_med = pd.Series(rng).groupby(days.year).transform("median").values   # that year's typical daily range (median)
next_ok = np.zeros(nd, bool)
next_ok[:-1] = (inst[1:] == inst[:-1]) & (np.diff(days.values).astype("timedelta64[D]").astype(int) <= 4)


def climax(i):
    """Find a relentless opening selloff on day i: returns (first bar, last bar), or None. The rules are in the post."""
    best = None
    for a in range(0, 10):                                       # 1. starts between bar 1 and bar 10
        for b in range(a + 5, 22):                               #    mostly done by bar 20 (ends by bar 22 at the latest)
            h, l, o, c = bh[i, a:b + 1], bl[i, a:b + 1], bo[i, a:b + 1], bc[i, a:b + 1]
            n = len(h)
            if h.argmax() != 0 or l.argmin() != n - 1:           #    the first bar is the run's high, the last bar is the run's low
                continue
            body = c - o
            bear, bull = body < 0, body > 0
            total = h[0] - l[-1]
            if n < 10 and bull.any():                            # 2. under 10 bars, every bar must be a bear bar
                continue
            if bear.mean() < 2 / 3:                              # 3. at least two thirds bear bars
                continue
            if bull.any() and body[bull].max() > 0.10 * total:   #    bull bars can only be small: body no more than 10% of the whole drop
                continue
            small = body <= 0.10 * total
            run = longest = 0
            for s in small:
                run = run + 1 if s else 0
                longest = max(longest, run)
            if longest < min(8, n):                              # 4. at least 8 bars in a row with no real bull bar
                continue
            if (h[1:] < h[:-1]).mean() < 0.75:                   # 5. at least three quarters of the bars have a lower high than the bar before
                continue
            prev_low = np.minimum.accumulate(l)[:-1]
            ok = (h[0] - prev_low) > 0.2 * total                 #    only check bounces once it has fallen 20% of the drop
            if ok.any() and (((c[1:] - prev_low) / total)[ok].max() > 0.20 or ((h[1:] - prev_low) / total)[ok].max() > 0.35):
                continue                                         #    bounces along the way: close no more than 20% of the drop, high no more than 35%
            drop20 = (bh[i, a:min(b, 19) + 1].max() - bl[i, a:min(b, 19) + 1].min()) / day_o[i] * 100
            if drop20 < 0.6 * rng_med[i]:                        # 6. the drop within the first 20 bars is at least 60% of that year's typical daily range
                continue
            key = (total, n)                                     # if several cuts qualify on the same day, keep the one that falls the most
            if best is None or key > best[0]:
                best = (key, a, b)
    return None if best is None else best[1:]


rows = []
for i in range(nd):
    r = climax(i)
    if r is None:
        continue
    a, b = r
    top, low = bh[i, a], bl[i, b]
    leg = top - low
    ah, al = bh[i, b + 1:], bl[i, b + 1:]                        # from the end of the selloff to the close
    pos = lambda p: (p - low) / leg                              # price relative to the leg: 0 = the leg's low, 1 = where the leg started
    hit_low = np.where(al < low)[0]
    rows.append(dict(
        i=i, date=days[i], a=a, b=b, n=b - a + 1, leg_pct=leg / day_o[i] * 100,
        more=-pos(al.min()), bounce=pos(ah.max()), cpos=pos(day_c[i]),
        low_bar=int(np.argmin(bl[i])),                           # which bar made the day's low
        first_new_low=int(hit_low[0]) + 1 if len(hit_low) else -1,   # how many bars after the leg ends the first new low comes
        path=pos(bc[i, b + 1:b + 1 + 58]).tolist(),              # position of each close over the 58 bars (4 h 50 min) after the leg ends
        h12=pos(ah[:12].max()), l12=-pos(al[:12].min()),         # high and low within 1 hour after the leg ends
    ))
d = pd.DataFrame(rows)
d["cls"] = np.where(d.cpos < -0.25, "trend resumption", np.where(d.cpos >= 0.8, "reversal", "trading range"))
pct = lambda s: f"{100 * np.mean(s):.1f}%"
print(f"sample {nd} days; relentless opening selloffs {len(d)} days ({100 * len(d) / nd:.1f}%), by year: {d.date.dt.year.value_counts().sort_index().to_dict()}")
print(f"the leg: median length {d.n.median():.0f} bars, drop quartiles {np.round(d.leg_pct.quantile([.25, .5, .75]).values, 2)}%, "
      f"median drop ÷ that year's typical daily range {np.median(d.leg_pct.values / rng_med[d.i]):.2f}")
print(f"leg ends: before 10:00 {pct(d.b < 6)}, 10:00–10:30 {pct((d.b >= 6) & (d.b < 12))}, 10:30–11:00 {pct((d.b >= 12) & (d.b < 18))}, after 11:00 {pct(d.b >= 18)}")

# three groups
print("\n== three groups: close more than 0.25 legs below the low = trend resumption; close back 80% or more = reversal; in between = trading range")
print({k: f"{v * 100:.0f}% ({c} days)" for (k, v), c in zip(d.cls.value_counts(normalize=True).items(), d.cls.value_counts().values)})
for lo, hi in [(-0.25, 0.8), (0, 0.8), (-0.5, 0.8), (-0.25, 0.7), (-0.25, 1.0)]:
    print(f"  cutoffs {lo:+.2f} / {hi:.1f}: trend resumption {pct(d.cpos < lo)}, trading range {pct((d.cpos >= lo) & (d.cpos < hi))}, reversal {pct(d.cpos >= hi)}")
for k in ["trend resumption", "trading range", "reversal"]:
    g = d[d.cls == k]
    print(f"  {k} ({len(g)} days): new low {pct(g.more > 0)}, median further down {g.more.median():.2f} legs, median biggest bounce {g.bounce.median():.2f} legs, "
          f"median close {g.cpos.median():.2f}, median leg size {g.leg_pct.median():.2f}%, day's low is the leg's low {pct(g.more <= 0)}")

# what the follow-through looks like
print("\n== from the end of the leg to the close")
print(f"new low {pct(d.more > 0)}; further down ≥0.25 legs {pct(d.more >= .25)}, ≥0.5 legs {pct(d.more >= .5)}, ≥1 leg {pct(d.more >= 1)}; median further down {d.more.median():.2f} legs")
fl = d.first_new_low[d.first_new_low > 0]
print(f"bars after the leg ends until the first new low: median {fl.median():.0f}, within 6 bars {pct(fl <= 6)}, within 12 bars {pct(fl <= 12)}")
print(f"median biggest bounce {d.bounce.median():.2f} legs; ≥0.5 {pct(d.bounce >= .5)}, ≥0.8 {pct(d.bounce >= .8)}, ≥1 {pct(d.bounce >= 1)}")
b80 = d[d.bounce >= 0.8]
print(f"of the {len(b80)} days bouncing past 80%: still closing above 80% {pct(b80.cpos >= 0.8)}, falling back below half {pct(b80.cpos < 0.5)}")
print(f"day's low: the leg's low {pct(d.more <= 0)}, before 11:10 {pct(d.low_bar < 20)}, 11:10–13:00 {pct((d.low_bar >= 20) & (d.low_bar < 42))}, "
      f"13:00–15:00 {pct((d.low_bar >= 42) & (d.low_bar < 66))}, after 15:00 {pct(d.low_bar >= 66)}")

# testing the low: first a bounce of ≥0.3 legs, then back within 0.1 legs of the low; after that, broken or held?
tested = broke = 0
held_c, broke_c = [], []
for r in d.itertuples():
    ah, al = bh[r.i, r.b + 1:], bl[r.i, r.b + 1:]
    low, leg = bl[r.i, r.b], bh[r.i, r.a] - bl[r.i, r.b]
    up = np.where(ah >= low + 0.3 * leg)[0]
    if not len(up):
        continue
    back = np.where(al[up[0]:] <= low + 0.1 * leg)[0]
    if not len(back):
        continue
    tested += 1
    if al[up[0] + back[0]:].min() < low - 0.1 * leg:
        broke += 1
        broke_c.append(r.cpos)
    else:
        held_c.append(r.cpos)
print(f"testing the low: {tested} days ({100 * tested / len(d):.1f}%) bounced ≥0.3 legs and came back near the low; of those, broke more than 0.1 legs below {100 * broke / tested:.1f}%, held {100 * (tested - broke) / tested:.1f}%; "
      f"median close: held {np.median(held_c):.2f}, broken {np.median(broke_c):.2f}")

# what you can see 1 hour (12 bars) after the leg ends: how the three groups change
print("\n== 1 hour after the leg ends → three groups")
for name, mask in [("new low within 1 hour", d.l12 > 0), ("no new low within 1 hour", d.l12 <= 0), ("bounce of ≥0.5 legs within 1 hour", d.h12 >= .5),
                   ("no new low and bounce under 0.5 legs within 1 hour", (d.l12 <= 0) & (d.h12 < .5)), ("new low of ≥0.25 legs within 1 hour", d.l12 >= .25)]:
    g = d[mask]
    print(f"  {name}: {len(g)} days ({pct(mask)}) → trend resumption {pct(g.cls == 'trend resumption')} / trading range {pct(g.cls == 'trading range')} / reversal {pct(g.cls == 'reversal')}")

# the next day
j = d.i[next_ok[d.i]].values
n = j + 1
print(f"\n== the next day ({len(j)} days): closes up {pct(day_c[n] > day_o[n])}, closes down {pct(day_c[n] < day_o[n])}; median range ÷ that year's median {np.median(rng[n] / rng_med[n]):.2f}; "
      f"breaks today's low {pct(day_l[n] < day_l[j])}; baseline: next day closes up across all days {pct(day_c[np.where(next_ok)[0] + 1] > day_o[np.where(next_ok)[0] + 1])}")

paths = np.array(d.path.tolist())
json.dump(dict(n=len(d), q25=np.percentile(paths, 25, 0).round(3).tolist(), q50=np.percentile(paths, 50, 0).round(3).tolist(),
               q75=np.percentile(paths, 75, 0).round(3).tolist(), above=(paths > 0).mean(0).round(3).tolist(),
               split={k: round(float((d.cls == k).mean()), 3) for k in ["trend resumption", "trading range", "reversal"]}),
          open("open-selloff.json", "w"))
d.drop(columns=["path"]).assign(date=d.date.dt.strftime("%Y-%m-%d")).to_csv("open-selloff-days.csv", index=False)

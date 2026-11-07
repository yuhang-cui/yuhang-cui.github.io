# 开局连绵抛售之后的跟随：开盘前 20 根 5 分钟 K 线里出现一段几乎根根阴线、高点一级级往下的抛售，
# 这一段走完以后，当天剩下的时间是震荡、继续跌还是反转？
# 输入：清洗后的 ES 1 分钟 K 线（Databento ES.c.0，时间是 UTC）；输出：打印统计，写出 open-selloff.json（文章里的路径图用）
import json
import warnings
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")                                # 有 99 分钟缺数据，nanmax 会报 All-NaN 警告，不影响结果
df = pd.read_csv("ES-1min_标准版.csv", usecols=["ts_event", "open", "high", "low", "close", "instrument_id"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
m = (t.dt.hour * 60 + t.dt.minute - 570).values                 # 距 09:30 的分钟数
keep = (m >= 0) & (m < 405)                                      # 日盘 09:30–16:15
df, m, date = df[keep], m[keep], t[keep].dt.normalize().values
days, row = np.unique(date, return_inverse=True)
days = pd.DatetimeIndex(days)
nd = len(days)
M = {}
for k in ["open", "high", "low", "close"]:                       # 每天一行、每分钟一列的矩阵，缺的那几分钟是 NaN
    a = np.full((nd, 405), np.nan)
    a[row, m] = df[k].values
    M[k] = a
inst = np.zeros(nd, dtype=int)
inst[row] = df.instrument_id.values                              # 当天用的是哪张合约，比较"今天和明天"时要相同
C = pd.DataFrame(M["close"]).ffill(axis=1).values                # 缺的分钟用前一分钟的收盘补上
O = np.where(np.isnan(M["open"]), C, M["open"])
H, L = M["high"], M["low"]

NB = 81                                                          # 一天 81 根 5 分钟 K 线
bo = O[:, ::5]
bc = np.array([C[:, k * 5:(k + 1) * 5][:, -1] for k in range(NB)]).T
bh = np.array([np.nanmax(H[:, k * 5:(k + 1) * 5], 1) for k in range(NB)]).T
bl = np.array([np.nanmin(L[:, k * 5:(k + 1) * 5], 1) for k in range(NB)]).T
day_o, day_c, day_h, day_l = O[:, 0], C[:, -1], np.nanmax(H, 1), np.nanmin(L, 1)
rng = (day_h - day_l) / day_o * 100
rng_med = pd.Series(rng).groupby(days.year).transform("median").values   # 当年平常一天的波幅（中位数）
next_ok = np.zeros(nd, bool)
next_ok[:-1] = (inst[1:] == inst[:-1]) & (np.diff(days.values).astype("timedelta64[D]").astype(int) <= 4)


def climax(i):
    """在第 i 天找开局连绵抛售：返回 (起点根, 终点根)，找不到返回 None。7 条规则见文章。"""
    best = None
    for a in range(0, 10):                                       # 1. 从第 1–10 根之间开始
        for b in range(a + 5, 22):                               #    主要部分在第 20 根前走完（最晚到第 22 根）
            h, l, o, c = bh[i, a:b + 1], bl[i, a:b + 1], bo[i, a:b + 1], bc[i, a:b + 1]
            n = len(h)
            if h.argmax() != 0 or l.argmin() != n - 1:           #    起点是这段的最高点，终点是这段的最低点
                continue
            body = c - o
            bear, bull = body < 0, body > 0
            total = h[0] - l[-1]
            if n < 10 and bull.any():                            # 2. 不到 10 根就必须根根阴线
                continue
            if bear.mean() < 2 / 3:                              # 3. 阴线至少占三分之二
                continue
            if bull.any() and body[bull].max() > 0.10 * total:   #    阳线只能是"兜底"的小阳线：实体不超过整段跌幅的 10%
                continue
            small = body <= 0.10 * total
            run = longest = 0
            for s in small:
                run = run + 1 if s else 0
                longest = max(longest, run)
            if longest < min(8, n):                              # 4. 至少连续 8 根没有像样的阳线
                continue
            if (h[1:] < h[:-1]).mean() < 0.75:                   # 5. 至少四分之三的 K 线最高点低于前一根
                continue
            prev_low = np.minimum.accumulate(l)[:-1]
            ok = (h[0] - prev_low) > 0.2 * total                 #    跌出整段的两成以后才开始看反弹
            if ok.any() and (((c[1:] - prev_low) / total)[ok].max() > 0.20 or ((h[1:] - prev_low) / total)[ok].max() > 0.35):
                continue                                         #    中途反弹：收盘不超过整段跌幅的 20%，最高不超过 35%
            drop20 = (bh[i, a:min(b, 19) + 1].max() - bl[i, a:min(b, 19) + 1].min()) / day_o[i] * 100
            if drop20 < 0.6 * rng_med[i]:                        # 6. 前 20 根里的跌幅至少是当年平常一天波幅的六成
                continue
            key = (total, n)                                     # 同一天有几种切法时，取跌得最多的那段
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
    ah, al = bh[i, b + 1:], bl[i, b + 1:]                        # 这段抛售走完以后到收盘
    pos = lambda p: (p - low) / leg                              # 价格相对这一段：0 = 段的最低点，1 = 段的起点
    hit_low = np.where(al < low)[0]
    rows.append(dict(
        i=i, date=days[i], a=a, b=b, n=b - a + 1, leg_pct=leg / day_o[i] * 100,
        more=-pos(al.min()), bounce=pos(ah.max()), cpos=pos(day_c[i]),
        low_bar=int(np.argmin(bl[i])),                           # 全天最低点出现在第几根
        first_new_low=int(hit_low[0]) + 1 if len(hit_low) else -1,   # 段尾之后第几根才再创新低
        path=pos(bc[i, b + 1:b + 1 + 58]).tolist(),              # 段尾之后 58 根（4 小时 50 分）每根收盘的位置
        h12=pos(ah[:12].max()), l12=-pos(al[:12].min()),         # 段尾之后 1 小时内的最高、最低
    ))
d = pd.DataFrame(rows)
d["cls"] = np.where(d.cpos < -0.25, "继续跌", np.where(d.cpos >= 0.8, "反转", "震荡"))
pct = lambda s: f"{100 * np.mean(s):.1f}%"
print(f"样本 {nd} 天；开局连绵抛售 {len(d)} 天（{100 * len(d) / nd:.1f}%），每年：{d.date.dt.year.value_counts().sort_index().to_dict()}")
print(f"这一段：长度中位数 {d.n.median():.0f} 根，跌幅四分位 {np.round(d.leg_pct.quantile([.25, .5, .75]).values, 2)}%，"
      f"跌幅 ÷ 当年平常一天的波幅 中位数 {np.median(d.leg_pct.values / rng_med[d.i]):.2f}")
print(f"段尾时间：10:00 前 {pct(d.b < 6)}，10:00–10:30 {pct((d.b >= 6) & (d.b < 12))}，10:30–11:00 {pct((d.b >= 12) & (d.b < 18))}，11:00 后 {pct(d.b >= 18)}")

# 三分法
print("\n== 三分：收盘比段的最低点还低 0.25 段以上 = 继续跌；收盘收回八成以上 = 反转；中间 = 震荡")
print({k: f"{v * 100:.0f}%（{c} 天）" for (k, v), c in zip(d.cls.value_counts(normalize=True).items(), d.cls.value_counts().values)})
for lo, hi in [(-0.25, 0.8), (0, 0.8), (-0.5, 0.8), (-0.25, 0.7), (-0.25, 1.0)]:
    print(f"  切点 {lo:+.2f} / {hi:.1f}：继续跌 {pct(d.cpos < lo)}，震荡 {pct((d.cpos >= lo) & (d.cpos < hi))}，反转 {pct(d.cpos >= hi)}")
for k in ["继续跌", "震荡", "反转"]:
    g = d[d.cls == k]
    print(f"  {k}（{len(g)} 天）：再创新低 {pct(g.more > 0)}，再跌中位数 {g.more.median():.2f} 段，最大反弹中位数 {g.bounce.median():.2f} 段，"
          f"收盘位置中位数 {g.cpos.median():.2f}，段跌幅中位数 {g.leg_pct.median():.2f}%，全天最低点就是段的最低点 {pct(g.more <= 0)}")

# 跟随的样子
print("\n== 段尾之后到收盘")
print(f"再创新低 {pct(d.more > 0)}；再跌 ≥0.25 段 {pct(d.more >= .25)}，≥0.5 段 {pct(d.more >= .5)}，≥1 段 {pct(d.more >= 1)}；再跌中位数 {d.more.median():.2f} 段")
fl = d.first_new_low[d.first_new_low > 0]
print(f"第一次再创新低在段尾之后第几根：中位数 {fl.median():.0f}，6 根内 {pct(fl <= 6)}，12 根内 {pct(fl <= 12)}")
print(f"最大反弹中位数 {d.bounce.median():.2f} 段；≥0.5 {pct(d.bounce >= .5)}，≥0.8 {pct(d.bounce >= .8)}，≥1 {pct(d.bounce >= 1)}")
b80 = d[d.bounce >= 0.8]
print(f"反弹过八成的 {len(b80)} 天里，收盘还守在八成以上的 {pct(b80.cpos >= 0.8)}，跌回一半以下的 {pct(b80.cpos < 0.5)}")
print(f"全天最低点出现：段的最低点 {pct(d.more <= 0)}，11:10 前 {pct(d.low_bar < 20)}，11:10–13:00 {pct((d.low_bar >= 20) & (d.low_bar < 42))}，"
      f"13:00–15:00 {pct((d.low_bar >= 42) & (d.low_bar < 66))}，15:00 后 {pct(d.low_bar >= 66)}")

# 测试低点：先反弹 ≥0.3 段，再回到离最低点 0.1 段以内；回来以后是破了还是守住
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
print(f"测试低点：先反弹 ≥0.3 段再回到低点附近的 {tested} 天（{100 * tested / len(d):.1f}%）；其中又跌破 0.1 段以上 {100 * broke / tested:.1f}%，守住 {100 * (tested - broke) / tested:.1f}%；"
      f"收盘位置中位数 守住 {np.median(held_c):.2f}，破了 {np.median(broke_c):.2f}")

# 段尾之后 1 小时（12 根）就能看到的：三分法怎么变
print("\n== 段尾之后 1 小时的情况 → 三分")
for name, mask in [("1 小时内再创新低", d.l12 > 0), ("1 小时内没创新低", d.l12 <= 0), ("1 小时内反弹 ≥0.5 段", d.h12 >= .5),
                   ("1 小时内既没新低、反弹也不到 0.5 段", (d.l12 <= 0) & (d.h12 < .5)), ("1 小时内跌出 ≥0.25 段的新低", d.l12 >= .25)]:
    g = d[mask]
    print(f"  {name}：{len(g)} 天（{pct(mask)}）→ 继续跌 {pct(g.cls == '继续跌')} / 震荡 {pct(g.cls == '震荡')} / 反转 {pct(g.cls == '反转')}")

# 第二天
j = d.i[next_ok[d.i]].values
n = j + 1
print(f"\n== 第二天（{len(j)} 天）：收阳 {pct(day_c[n] > day_o[n])}，收阴 {pct(day_c[n] < day_o[n])}；波幅 ÷ 当年中位数 中位数 {np.median(rng[n] / rng_med[n]):.2f}；"
      f"跌破今天最低 {pct(day_l[n] < day_l[j])}；基准：所有日子第二天收阳 {pct(day_c[np.where(next_ok)[0] + 1] > day_o[np.where(next_ok)[0] + 1])}")

paths = np.array(d.path.tolist())
json.dump(dict(n=len(d), q25=np.percentile(paths, 25, 0).round(3).tolist(), q50=np.percentile(paths, 50, 0).round(3).tolist(),
               q75=np.percentile(paths, 75, 0).round(3).tolist(), above=(paths > 0).mean(0).round(3).tolist(),
               split={k: round(float((d.cls == k).mean()), 3) for k in ["继续跌", "震荡", "反转"]}),
          open("open-selloff.json", "w"))
d.drop(columns=["path"]).assign(date=d.date.dt.strftime("%Y-%m-%d")).to_csv("open-selloff-days.csv", index=False)

# 20 均线：日盘 5 分钟图上，有多少日子会碰到 20 均线？第一次碰到在第几根？离开均线能连续多少根？
# 输入：清洗后的 ES 1 分钟 K 线（Databento ES.c.0，时间是 UTC，含 instrument_id 列）
import numpy as np
import pandas as pd

df = pd.read_csv("ES-1min_标准版.csv", usecols=["ts_event", "instrument_id", "high", "low", "close"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
m = t.dt.hour * 60 + t.dt.minute - 570                      # 距 09:30 的分钟数
rth = df[(m >= 0) & (m < 405)].assign(date=t.dt.normalize(), bar=m // 5)   # 日盘 09:30–16:15，每天 81 根 5 分钟

# 合成 5 分钟 K 线，排成“每天一行、81 列”的表；没有成交的 5 分钟（2020 年 3 月熔断）是空的
bars = rth.groupby(["date", "bar"]).agg(h=("high", "max"), l=("low", "min"), c=("close", "last"))
H, L, C = (bars[k].unstack().reindex(columns=range(81)).values for k in ["h", "l", "c"])
days = bars.index.get_level_values(0).unique()
inst = rth.groupby("date").instrument_id.first().values

# 20 均线：α = 2/21，只用日盘 K 线，一天接着一天往下算；空的 5 分钟跳过
# 换合约后的第一天重新起算，这一天不计入（新旧合约价格对不上）；数据第一天同理
ema = np.full(H.shape, np.nan)
use = np.ones(len(days), bool)
e = None
for i in range(len(days)):
    if i == 0 or inst[i] != inst[i - 1]:
        e, use[i] = None, False
    for k in range(81):
        if not np.isnan(C[i, k]):
            e = C[i, k] if e is None else 2 / 21 * C[i, k] + 19 / 21 * e
        ema[i, k] = e

touch = (L <= ema) & (ema <= H)                              # 均线在这根 K 线的最高价和最低价之间
first = np.where(touch.any(1), touch.argmax(1) + 1, 0)[use]  # 第一次碰到是第几根，没碰到记 0
d = days[use]
print(f"样本 {len(first)} 天，碰到 20 均线 {100 * (first > 0).mean():.2f}%，第 1 根就碰到 {100 * (first == 1).mean():.2f}%")
print("没碰到的日子：", list(d[first == 0].strftime("%Y-%m-%d")))
for n in [3, 6, 12, 18, 24, 36]:
    print(f"到第 {n} 根已经碰过：{100 * ((first > 0) & (first <= n)).mean():.1f}%")
print((pd.Series(first > 0, index=d).groupby(d.year).mean() * 100).round(2).to_string())   # 每年碰到的比例

# 离开均线：整根 K 线在均线上方（最低价 > 均线）或下方（最高价 < 均线），连续几根算一段，每天开盘重新数
streaks, longest = {"上方": [], "下方": []}, []
for i in np.flatnonzero(use):
    best = 0
    for side, off in [("上方", L[i] > ema[i]), ("下方", H[i] < ema[i])]:
        run = 0
        for x in list(off) + [False]:                       # 末尾补一个 False，把收盘前的最后一段也收进来
            if x:
                run += 1
            elif run:
                streaks[side].append(run)                   # 一段结束，记下它的长度
                best = max(best, run)
                run = 0
    longest.append(best)
up, down = np.array(streaks["上方"]), np.array(streaks["下方"])
both, longest = np.r_[up, down], np.array(longest)
print(f"离开均线 {len(both)} 段（上方 {len(up)} 段，下方 {len(down)} 段），平均每天 {len(both) / use.sum():.1f} 段")
print(f"长度的中位数 {np.median(both):.0f} 根，20 根以内 {100 * (both <= 20).mean():.1f}%")
for n in [10, 20, 40]:
    print(f"至少连续 {n} 根：上方 {100 * (up >= n).mean():.1f}%（{(up >= n).sum()} 段），下方 {100 * (down >= n).mean():.1f}%（{(down >= n).sum()} 段）")
print(f"出现过至少一段 20 根以上的日子：{100 * (longest >= 20).mean():.1f}%")

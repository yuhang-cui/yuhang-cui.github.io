# 开盘连续同色 K 线：日盘开盘的前 N 根 K 线全是阳线（阴线），这一天会怎样收？
# 输入：清洗后的 ES 1 分钟 K 线（Databento ES.c.0，时间是 UTC）
import numpy as np
import pandas as pd

df = pd.read_csv("ES-1min_标准版.csv", usecols=["ts_event", "open", "high", "low", "close"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
m = t.dt.hour * 60 + t.dt.minute - 570                      # 距 09:30 的分钟数
rth = df[(m >= 0) & (m < 405)].assign(date=t.dt.normalize(), m=m)   # 日盘 09:30–16:15

day = rth.groupby("date").agg(o=("open", "first"), h=("high", "max"), l=("low", "min"), c=("close", "last"))
print(f"样本 {len(day)} 天，收阳 {100 * (day.c > day.o).mean():.1f}%，收阴 {100 * (day.c < day.o).mean():.1f}%")

for T in [5, 15, 30, 60]:                                   # K 线周期（最后一根不满也算一根，比如 60 分钟的 15:30–16:15）
    k = rth.assign(k=rth.m // T).groupby(["date", "k"])
    bars = k.agg(o=("open", "first"), h=("high", "max"), l=("low", "min"), c=("close", "last"))
    color = np.sign(bars.c - bars.o).unstack()              # 每天一行：第 1、2、3……根是阳（+1）还是阴（−1）
    hi = bars.h.unstack().cummax(axis=1)                    # 到第 N 根为止的最高价
    lo = bars.l.unstack().cummin(axis=1)
    close = bars.c.unstack()
    for N in range(1, (8 if T <= 15 else 6) + 1):            # 和交互图一样：5、15 分钟看到第 8 根，30、60 分钟看到第 6 根
        for s, name in [(1, "阳"), (-1, "阴")]:
            sig = (color.iloc[:, :N] == s).all(axis=1)      # 开盘前 N 根全是阳线（阴线）
            d = day[sig]
            sig_close = close.iloc[:, N - 1][sig]           # 信号收盘 = 第 N 根的收盘价
            hiN, loN = hi.iloc[:, N - 1][sig], lo.iloc[:, N - 1][sig]
            if s > 0:
                same = d.c > d.o                             # 全天收阳
                beyond = d.c > sig_close                     # 收盘高于信号收盘：在第 N 根收盘买进，拿到收盘是赚的
                opp = loN == d.l                             # 全天最低点已经在前 N 根里
                more = d.h > hiN                             # 之后还创出新高
            else:
                same, beyond, opp, more = d.c < d.o, d.c < sig_close, hiN == d.h, d.l < loN
            print(f"{T:2d} 分钟 前 {N} 根全{name}：{sig.sum():4d} 天（{100 * sig.mean():.1f}%）"
                  f"  全天同色 {100 * same.mean():.1f}%  收在信号收盘之外 {100 * beyond.mean():.1f}%"
                  f"  反方向极值已出现 {100 * opp.mean():.1f}%  之后还创新{'高' if s > 0 else '低'} {100 * more.mean():.1f}%")

# 开盘连续 6 根 60 分钟都收阳：第 6 根 15:30 收线以后，尾盘 45 分钟怎么走
k = rth.assign(k=rth.m // 60).groupby(["date", "k"])
h60 = k.agg(o=("open", "first"), c=("close", "last"))
color, close = np.sign(h60.c - h60.o).unstack(), h60.c.unstack()
six = (color.iloc[:, :6] == 1).all(axis=1)
d, c6 = day[six], close.iloc[:, 5][six]
tail = (d.c - c6) / c6 * 100                                # 15:30 → 收盘的涨跌 %
print(f"\n60 分钟前 6 根全阳：{six.sum()} 天；收盘高于 15:30 {100 * (tail > 0).mean():.1f}%，"
      f"尾盘跌超 0.3% 的 {(tail < -0.3).sum()} 天；收盘离全天最高 中位数 {100 * ((d.h - d.c) / (d.h - d.l)).median():.0f}% 全天波幅")

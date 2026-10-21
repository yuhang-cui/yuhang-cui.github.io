# 开盘就是最高 / 最低价：日盘第一根 K 线开在它自己的最高价或最低价上，之后价格会不会回到开盘价？
# 输入：清洗后的 ES 1 分钟 K 线（Databento ES.c.0，时间是 UTC）
import numpy as np
import pandas as pd

df = pd.read_csv("ES-1min_标准版.csv", usecols=["ts_event", "open", "high", "low"])
t = pd.to_datetime(df.ts_event, utc=True).dt.tz_convert("US/Eastern").dt.tz_localize(None)
m = t.dt.hour * 60 + t.dt.minute - 570                      # 距 09:30 的分钟数
rth = df[(m >= 0) & (m < 405)].assign(date=t.dt.normalize(), m=m)   # 日盘 09:30–16:15

# 排成“每天一行、405 列（每分钟一列）”的表，没有成交的那一分钟是空的
H = rth.pivot(index="date", columns="m", values="high").reindex(columns=range(405)).values
L = rth.pivot(index="date", columns="m", values="low").reindex(columns=range(405)).values
op = rth.pivot(index="date", columns="m", values="open")[0].values   # 开盘价 = 09:30 那根的开盘价
day_hi, day_lo = np.nanmax(H, 1), np.nanmin(L, 1)
keep = (op == day_hi) | (op == day_lo)                      # 开盘价就是全天的最高或最低价
print(f"样本 {len(op)} 天；日 K 线开在最高价 {(op == day_hi).sum()} 天，开在最低价 {(op == day_lo).sum()} 天，合计 {100 * keep.mean():.2f}%")

for T in [1, 5, 15, 30, 60]:                                # 第一根 K 线用不同周期
    on_lo = op == np.nanmin(L[:, :T], 1)                    # 开在最低价：开盘价 = 第一根的最低价（完全相等）
    on_hi = op == np.nanmax(H[:, :T], 1)                    # 开在最高价
    shaved = on_lo | on_hi
    # 第一根收线以后，第一次回到开盘价是哪一分钟（开在最低价看最低价 ≤ 开盘价，开在最高价看最高价 ≥ 开盘价）
    back = np.where(on_lo[:, None], L <= op[:, None], H >= op[:, None])
    back[:, :T] = False
    when = np.where(back.any(1), back.argmax(1), -1)[shaved]
    n = shaved.sum()
    print(f"第一根 {T:2d} 分钟：开在最高或最低价 {n} 天（{100 * n / len(op):.2f}%，最低 {on_lo.sum()}、最高 {on_hi.sum()}）；"
          f"当天回到开盘价 {100 * (when >= 0).mean():.1f}%；开盘价守到收盘 {100 * keep[shaved].mean():.1f}%")
    if T == 5:
        for hhmm, mins in [("9:40", 10), ("10:00", 30), ("10:30", 60), ("11:30", 120)]:
            print(f"    到 {hhmm} 已经回到开盘价：{100 * ((when >= 0) & (when < mins)).mean():.1f}%")
        med = int(np.median(when[when >= 0])) + 1           # 回来的日子里，回来时间的中位数（那一分钟收线时，距 09:30 的分钟）
        print(f"    回来的日子里，一半在 {9 + (30 + med) // 60}:{(30 + med) % 60:02d} 之前就回来了")

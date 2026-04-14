# beadify_py（拼豆模板生成器 · Python版）

输入一张图片，输出：
- 一张带网格线的模板图（PNG），每格填充匹配后的拼豆颜色
- 一份颜色清单（Excel），统计每种颜色所需豆子数量

## 安装

```bash
cd beadify_py
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## 使用

```bash
python3 beadify.py --input ../your_image.jpg --grid 50 50 --palette palettes/perler_sample.csv --cell-size 24
```

输出默认在 `beadify_py/output/`：
- `template_50x50.png`
- `colors_50x50.xlsx`

## 色板（Palette）

色板用 CSV 表示，至少包含三列：
- `name`：颜色名/色号（例如 `A1`、`Perler Red`）
- `hex`：颜色 HEX（例如 `#FF0000`）
- `brand`：可选（例如 `perler`、`hama`）

你可以把商家的真实色卡（A1-A100 → HEX）放到一个 CSV，然后传给 `--palette`，就能做到“命名与商家一致”。

注意：仓库内置的 `perler_sample.csv` / `hama_sample.csv` 只是示例色板（方便你先跑通流程），并非官方/完整色卡；如果你提供商家或品牌的真实色卡 CSV，我可以帮你替换成精准版本。

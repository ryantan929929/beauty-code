#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
拼豆模板生成器（Python版）

输入：一张图片
处理：
  1) 将图片缩放为指定格子数量（例如 50x50）
  2) 对每个格子取平均颜色（通过 BOX 重采样实现）
  3) 将颜色匹配到色板（最近邻，RGB 欧氏距离）
输出：
  - 模板 PNG：每格填充匹配颜色，并画网格线
  - Excel 清单：列出每种颜色名称和所需数量

你最常改的参数：
  - 格子尺寸：命令行 `--grid W H`
  - 输出每格像素大小：命令行 `--cell-size`
"""

from __future__ import annotations

import argparse
import os
import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, TYPE_CHECKING

if TYPE_CHECKING:
    from PIL import Image as PILImage


@dataclass(frozen=True)
class PaletteColor:
    name: str
    hex: str
    r: int
    g: int
    b: int


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    s = hex_color.strip().lstrip("#")
    if len(s) == 3:
        s = "".join(ch * 2 for ch in s)
    if len(s) != 6:
        raise ValueError(f"Invalid hex color: {hex_color}")
    r = int(s[0:2], 16)
    g = int(s[2:4], 16)
    b = int(s[4:6], 16)
    return r, g, b


def load_palette_csv(path: Path) -> list[PaletteColor]:
    out: list[PaletteColor] = []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or "name" not in reader.fieldnames or "hex" not in reader.fieldnames:
            raise ValueError("Palette CSV 必须包含 name, hex 两列")
        for row in reader:
            name = str(row.get("name", "")).strip()
            hx = str(row.get("hex", "")).strip()
            if not name or not hx:
                continue
            r, g, b = _hex_to_rgb(hx)
            out.append(PaletteColor(name=name, hex=hx.upper(), r=r, g=g, b=b))
    if not out:
        raise ValueError("Palette CSV 为空")
    return out


def nearest_palette_color(r: int, g: int, b: int, palette: list[PaletteColor]) -> PaletteColor:
    best = palette[0]
    best_dist = 10**18
    for c in palette:
        dr = r - c.r
        dg = g - c.g
        db = b - c.b
        dist = dr * dr + dg * dg + db * db
        if dist < best_dist:
            best_dist = dist
            best = c
    return best


def image_to_grid_average(img: "PILImage", grid_w: int, grid_h: int) -> "PILImage":
    """
    将原图缩到 grid_w x grid_h。
    使用 BOX 重采样近似等价于“对每个格子取平均颜色”。
    """
    # Pillow 的 BOX 重采样适合做“区域平均”的缩小
    from PIL import Image

    return img.convert("RGB").resize((grid_w, grid_h), resample=Image.Resampling.BOX)


def render_template(
    grid_img: "PILImage",
    palette: list[PaletteColor],
    cell_size: int,
    grid_line: int,
) -> tuple["PILImage", list[PaletteColor]]:
    """
    grid_img: 尺寸为 (grid_w, grid_h)，每个像素代表一个格子的平均色
    输出：放大后的模板图 + 每格对应的调色板颜色（按行优先）
    """
    grid_w, grid_h = grid_img.size
    out_w = grid_w * cell_size
    out_h = grid_h * cell_size

    from PIL import Image, ImageDraw

    out = Image.new("RGB", (out_w, out_h), (255, 255, 255))
    draw = ImageDraw.Draw(out)

    pixels = grid_img.load()
    mapped: list[PaletteColor] = []

    for y in range(grid_h):
        for x in range(grid_w):
            pr, pg, pb = pixels[x, y]
            c = nearest_palette_color(pr, pg, pb, palette)
            mapped.append(c)
            x0 = x * cell_size
            y0 = y * cell_size
            draw.rectangle([x0, y0, x0 + cell_size, y0 + cell_size], fill=(c.r, c.g, c.b))

    # 画网格线（便于打印）
    if grid_line > 0:
        line_color = (0, 0, 0)
        for x in range(grid_w + 1):
            px = x * cell_size
            draw.line([(px, 0), (px, out_h)], fill=line_color, width=grid_line)
        for y in range(grid_h + 1):
            py = y * cell_size
            draw.line([(0, py), (out_w, py)], fill=line_color, width=grid_line)

    return out, mapped


def counts_to_excel(
    mapped: Iterable[PaletteColor],
    out_path: Path,
) -> "object":
    import pandas as pd

    rows = [{"name": c.name, "hex": c.hex} for c in mapped]
    df = pd.DataFrame(rows)
    summary = df.value_counts(["name", "hex"]).reset_index(name="count").sort_values("count", ascending=False)
    summary.to_excel(out_path, index=False)
    return summary


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, help="输入图片路径")
    # 方便你修改格子尺寸：这里直接改默认值即可
    p.add_argument("--grid", nargs=2, type=int, default=[50, 50], metavar=("W", "H"), help="格子数量，例如 50 50")
    p.add_argument("--palette", required=True, help="色板 CSV（含 name,hex 列）")
    p.add_argument("--cell-size", type=int, default=24, help="输出模板每格像素大小（越大越清晰/文件越大）")
    p.add_argument("--grid-line", type=int, default=1, help="网格线宽度（0 表示不画线）")
    p.add_argument("--out-dir", default="output", help="输出目录（默认 output）")
    p.add_argument("--out-prefix", default="template", help="输出文件名前缀")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    input_path = Path(args.input).expanduser().resolve()
    palette_path = Path(args.palette).expanduser().resolve()

    grid_w, grid_h = int(args.grid[0]), int(args.grid[1])
    if grid_w <= 0 or grid_h <= 0:
        raise ValueError("--grid 必须为正整数")

    out_dir = Path(args.out_dir)
    if not out_dir.is_absolute():
        out_dir = (Path(__file__).parent / out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    palette = load_palette_csv(palette_path)

    from PIL import Image

    with Image.open(input_path) as img:
        grid_img = image_to_grid_average(img, grid_w, grid_h)
        template_img, mapped = render_template(
            grid_img=grid_img,
            palette=palette,
            cell_size=int(args.cell_size),
            grid_line=int(args.grid_line),
        )

    png_path = out_dir / f"{args.out_prefix}_{grid_w}x{grid_h}.png"
    xlsx_path = out_dir / f"colors_{grid_w}x{grid_h}.xlsx"

    template_img.save(png_path, format="PNG", optimize=True)
    counts_to_excel(mapped, xlsx_path)

    print(f"OK\n- template: {png_path}\n- excel: {xlsx_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

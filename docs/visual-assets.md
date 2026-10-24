# KHB AIR 产品素材

用户提供的原始图样位于 `images/KHB-AIR/`。选取 `KHB 1 (1).png`（喷头装配、握柄展开）和 `KHB 1 (6).png`（握柄与机身细节）作为参考，逐张查看后使用内置 imagegen 生成透明侧视素材。生成文件保存在 `src/assets/khb-air.png`，1448×1086，RGBA，744,652 字节。没有使用 CLI/API 回退。

验收重点：黑色圆筒机身、黄黑分区、细长展开握柄、铰接分缝、椭圆按钮、短粗黑色旋转喷头、白底 KÄRCHER 铭牌和黄条。新图为游戏插画，保留产品辨识特征；不把生成图表述为官方产品照片。首页装备卡、游戏内手持装备和海报渲染共用此素材。

## 最终生成提示

```text
Create a precise isolated game equipment asset based on these TWO USER-SUPPLIED PRODUCT REFERENCE IMAGES. Subject is the exact Kärcher KHB AIR cordless folding cleaner shown, in its unfolded ready-to-use configuration with the short multi-mode nozzle ATTACHED as in reference 1. Preserve the exact industrial design and proportions: elongated rounded black cylindrical upper body, short thick ribbed black cylindrical nozzle with a narrow connector, long thin yellow front grip sweeping from beneath body, black rear spine of grip, oval black grip button, hinge seam near lower third, small ventilation slots under body. NO trigger guard, NO large battery foot, NO added stock, NO long lance, NO sci-fi modifications. Black body is mostly black, NOT yellow; yellow is confined to the underside and grip. White rectangular manufacturer badge with correctly readable black text KÄRCHER and a yellow horizontal bar beneath on side of upper barrel. Show one single product in a clean near-orthographic side view: nozzle points horizontally RIGHT, unfolded grip hangs downward from LEFT/rear third, with only a very subtle three-quarter view revealing round nozzle tip. Axial barrel is perfectly horizontal for a rotating 2D game sprite. Full object uncropped, tightly composed with roughly 8% transparent padding, 4:3 landscape image. Style: high quality faithful product illustration with soft physical material shading, slightly simplified for legibility at 80 pixels, crisp clean edges, real manufactured geometry; avoid comic reinterpretation. True transparent alpha background, no shadows on a floor, no extra items, no hands, no water, no captions outside the badge. This is a reference-faithful adaptation, accuracy of silhouette and yellow/black partition is the top priority.
```

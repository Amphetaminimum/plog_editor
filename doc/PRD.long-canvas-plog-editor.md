# Long Canvas Plog Editor

产品需求文档（PRD）

## 1. 产品概述

### 1.1 产品目标

开发一个**长画布图片博客编辑器（Long Canvas Plog Editor）**，用于创建以图片为主、文字为辅的视觉博客内容。

用户可以在**一个超长画布上自由排版**，插入图片、文字和标题信息，并最终导出为**高质量长图或网页内容**。

产品核心定位：

> 一个介于 Canva、Notion 和长图生成器之间的可视化编辑工具。

### 1.2 核心特点

- 自由排版
- 长画布编辑
- 高质量图片导出
- 现代化 UI
- 无复杂订阅限制

## 2. 使用场景

### 2.1 摄影博客

示例：

- Tokyo Trip
- Shibuya Sunset

用户可以：

- 插入照片
- 编写拍摄心得
- 排版成长图内容

### 2.2 旅行记录

示例：

- Day 3 - Kyoto
- Fushimi Inari Shrine

可插入内容：

- 照片
- 地点
- 文字说明

### 2.3 Coffee / Food Log

示例：

- Cafe Review
- Blue Bottle - Tokyo

### 2.4 社交媒体长图

适用平台：

- 小红书
- Twitter / X
- Instagram
- 博客分享页

## 3. 核心功能

### 3.1 Long Canvas（长画布）

编辑器基于**无限高度画布（Long Canvas）**。

特性：

- 画布高度自动增长
- 固定宽度
- 支持拖拽排版

可配置参数：

```yaml
canvas:
  width: 1080 | 1200 | custom
  height: auto-expand
  background:
    type: color | texture | image
    value: string
```

画布宽度建议：

- `1080px`：移动端友好，适合社交媒体长图
- `1200px`：更偏博客阅读体验
- `custom`：自定义宽度

### 3.2 画布背景

支持：

- 白色背景
- 自定义颜色
- 图片背景
- 纹理背景
- 平铺纹理

配置示例：

```yaml
background:
  type: color | texture | image
  value: string
```

## 4. 元素系统（Element System）

用户可以在画布中插入多种内容元素。

### 4.1 元素类型

当前支持：

- Text
- Image
- Divider
- Header
- Quote

未来扩展：

- Gallery
- Code Block
- Video

### 4.2 元素属性

每个元素至少具备位置、尺寸、内容和样式信息。

```yaml
element:
  id: string
  type: text | image | divider | header | quote
  x: number
  y: number
  width: number
  height: number
  content: any
  style: object
```

示例：

```json
{
  "type": "image",
  "x": 200,
  "y": 400,
  "width": 600,
  "height": 400,
  "src": "photo.jpg"
}
```

## 5. 文字编辑

文字元素需要支持完整的排版能力。

### 5.1 基础能力

- Font family
- Font size
- Color
- Alignment
- Weight
- Line height
- Letter spacing

### 5.2 高级能力

- Text box width
- Text wrap
- Font upload
- Custom font

## 6. 图片系统

图片是产品的核心内容类型。

### 6.1 基础功能

- Insert image
- Drag
- Resize
- Crop
- Rotate

### 6.2 图片样式

- Border radius
- Shadow
- Opacity
- Frame

### 6.3 图片优化

- Compression
- Lazy loading
- High-resolution export

## 7. Header（页眉）

用于展示博客标题信息。

结构示例：

```yaml
header:
  title: string
  subtitle: string
  date: string
  tags: string[]
```

展示示例：

- Tokyo Coffee Log
- Blue Bottle - Shibuya
- 2026-03-15

## 8. 排版辅助

为了提升排版效率，需要提供辅助工具。

支持：

- Grid
- Snap
- Guidelines
- Alignment tools

体验参考：

- Figma
- Canva

## 9. 导出功能

导出是产品关键能力之一。

### 9.1 图片导出

支持格式：

- PNG
- JPG
- WebP

导出参数：

- Width
- Quality
- Compression

示例：

- `1080px` width
- `quality: 90`

### 9.2 HTML 导出（可选）

生成目标：

- Blog page

特点：

- 图片 lazy loading
- 可分享链接
- SEO 友好

## 10. UI 结构

整体 UI 推荐三栏布局。

```text
--------------------------------
Toolbar
--------------------------------

| Elements | Canvas | Settings |
|----------|--------|----------|
|          |        |          |
|          |        |          |
|          |        |          |

--------------------------------
```

### 10.1 左侧

元素工具栏：

- Text
- Image
- Divider
- Header

### 10.2 中间

主画布区域：

- Drag
- Resize
- Edit

### 10.3 右侧

属性编辑区域：

- Font
- Color
- Size
- Image settings

## 11. 技术实现建议

### 11.1 Frontend

当前推荐方案：

- React
- Tiptap
- React-Konva

也可按实际编辑体验评估更适合的实现方式。

### 11.2 图片处理

推荐：

- `browser-image-compression`

### 11.3 导出

推荐：

- `html-to-image`

用途：

- Canvas / DOM -> PNG

## 12. 数据结构

### 12.1 Post

```yaml
post:
  id: string
  title: string
  canvas: object
  elements:
    - element
```

### 12.2 Element

```yaml
element:
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  content: any
  style: object
```

## 13. MVP（最小版本）

第一版只实现：

- Long canvas
- Insert text
- Insert image
- Drag / resize
- Export PNG

暂不实现：

- Templates
- AI features
- Collaboration
- Mobile editing

## 14. 产品定位总结

该产品可以理解为：

**Longform Visual Blog Editor**

介于以下产品形态之间：

- Notion
- Canva
- Long Image Generator

目标用户：

- 摄影师
- 旅行记录创作者
- 咖啡日志作者
- 内容创作者

## 15. MVP 成功标准

建议将 MVP 成功标准定义为：

- 用户可在单个长画布中完成图文排版
- 用户可插入并调整图片与文本元素
- 用户可导出清晰可分享的长图
- 编辑过程流畅，无明显卡顿

## 16. 后续迭代方向

优先级较高的后续能力：

- 模板系统
- 多图 Gallery 组件
- 字体管理与上传
- HTML 分享页导出
- 云端存储与项目管理
- 协作编辑

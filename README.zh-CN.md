# rough-route-map

[English](./README.md)

手绘风格路线图生成器，基于 [Rough.js](https://roughjs.com/) 和 [Skia Canvas](https://github.com/nicknisi/skia-canvas) 构建。

## 特性

- **手绘风格渲染** - 基于 Rough.js，每条线都有纸笔手绘质感
- **真实驾车路线** - 通过地图 API 获取实际路线（腾讯地图、高德地图）
- **多地图服务商** - 支持腾讯地图和高德地图，可扩展更多
- **灵活的位置输入** - 支持城市名、经纬度坐标，或两者同时传入
- **行程进度展示** - 实线表示已行驶路段，虚线表示未行驶路段
- **中国地图轮廓** - 自动加载省份边界作为底图
- **纸张纹理** - 可选的噪点纸张背景效果
- **装饰元素** - 环境装饰（太阳、云朵、爱心）和路线装饰（星星、脚印）
- **标题与图例** - 自动生成路线标题横幅和图例卡片
- **高清输出** - 可配置 DPI 缩放系数，支持高分辨率输出

## 安装

```bash
npm install rough-route-map
# 或
yarn add rough-route-map
```

## 快速开始

```js
const { generateMap } = require('rough-route-map');

const buffer = await generateMap({
  mapProvider: 'tencent',  // 'tencent' | 'amap'
  apiKey: 'YOUR_API_KEY',
  route: {
    start: { name: '杭州市' },
    end: { name: '洛阳市' },
    waypoints: [
      { name: '黄山市' },
      { name: '景德镇市' },
      { lat: 30.5928, lng: 114.3055 }  // 通过经纬度指定武汉
    ]
  },
  currentCity: { name: '武汉市' },
  output: './route-map.png'
});
```

## API

### `generateMap(config): Promise<Buffer>`

返回 PNG 图片的 Buffer。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `mapProvider` | `string` | `'tencent'` | 地图服务商（`'tencent'` \| `'amap'`） |
| `apiKey` | `string` | - | 地图 API Key **（必填）** |
| `route.start` | `LocationInput` | - | 起点位置 **（必填）** |
| `route.end` | `LocationInput` | - | 终点位置 **（必填）** |
| `route.waypoints` | `LocationInput[]` | `[]` | 途经点 |
| `currentCity` | `LocationInput` | `null` | 当前所在位置（区分已行驶/未行驶） |
| `width` | `number` | `1200` | 画布宽度（px） |
| `height` | `number` | `900` | 画布高度（px） |
| `style.roughness` | `number` | `1.5` | 手绘粗糙度 |
| `style.bowing` | `number` | `1.2` | 线条弯曲度 |
| `style.paperTexture` | `boolean` | `true` | 纸张纹理背景 |
| `showTitle` | `boolean` | `true` | 显示路线标题 |
| `showLegend` | `boolean` | `true` | 显示图例卡片 |
| `legendLabels.traveled` | `string` | `'Traveled'` | 已行驶路段的图例标签 |
| `legendLabels.remaining` | `string` | `'Remaining'` | 未行驶路段的图例标签 |
| `concurrency` | `number` | `5` | 每秒最大 API 请求数 |
| `dpi` | `number` | `2` | DPI 缩放系数，数值越大输出越清晰 |
| `output` | `string` | `'./route-map.png'` | 输出路径（空字符串则不保存文件） |

### 位置对象

每个位置（`start`、`end`、途经点、`currentCity`）都是一个 `LocationInput`：

```ts
interface LocationInput {
  name?: string;
  lat?: number;
  lng?: number;
}
```

| 场景 | 行为 |
|------|------|
| 提供了 `lat` + `lng` | 直接使用坐标，跳过地理编码 |
| 只提供了 `name` | 通过地理编码获取坐标 |
| 两者都提供 | 使用 `lat` + `lng`，`name` 用于显示 |
| `start` / `end` / `currentCity` 解析失败 | 抛出异常 |
| 途经点解析失败 | 跳过该途经点，输出警告 |

### 子模块导出

提供独立模块供高级用户使用：

```js
const { geo, api, drawing, config, providers } = require('rough-route-map');

// 直接创建 provider
const { createProvider } = require('rough-route-map/providers');
const provider = createProvider('amap', 'YOUR_KEY');
const coords = await provider.geocode('北京');
```

可用子模块：

| 模块 | 导入路径 | 说明 |
|------|---------|------|
| `geo` | `rough-route-map/geo` | 墨卡托投影、边界计算、最近点查找 |
| `api` | `rough-route-map/api` | GeoJSON 边界数据获取 |
| `drawing` | `rough-route-map/drawing` | Canvas 渲染（纹理、多边形、路线、标记、图例） |
| `config` | `rough-route-map/config` | 默认配置与 `mergeConfig()` |
| `providers` | `rough-route-map/providers` | 地图服务商工厂及实现 |
| `types` | `rough-route-map/types` | TypeScript 类型定义 |

## 示例

### Node.js

```bash
# 1. 在 examples/node/generate.js 中替换 apiKey
# 2. 运行：
yarn example
# 或
yarn build:dev && node examples/node/generate.js
```

## 前置条件

- Node.js >= 14
- 以下任一地图服务商的 API Key：
  - [腾讯地图](https://lbs.qq.com/dev/console/application/mine)
  - [高德地图](https://console.amap.com/dev/key/app)

## 开发

```bash
# 安装依赖
yarn install

# 构建（编译 + 压缩）
yarn build

# 仅编译，不压缩
yarn build:dev

# 代码检查
yarn lint
yarn lint:fix

# 运行示例
yarn example
```

## 项目结构

```
rough-route-map/
├── src/
│   ├── index.ts        # 包入口 - 导出 generateMap()
│   ├── types.ts        # TypeScript 类型定义
│   ├── config.ts       # 默认配置与 mergeConfig()
│   ├── geo.ts          # 投影、边界计算、最近点查找
│   ├── api.ts          # 通用 API 工具（GeoJSON）
│   ├── drawing.ts      # Canvas 渲染（纹理、多边形、路线、标记、图例）
│   └── providers/
│       ├── index.ts    # Provider 工厂
│       ├── tencent.ts  # 腾讯地图 Provider
│       └── amap.ts     # 高德地图 Provider
├── examples/
│   └── node/
│       └── generate.js
├── dist/               # 编译输出
├── package.json
└── README.md
```

## 许可证

MIT

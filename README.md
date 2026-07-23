# 暮光跃境 · Twilight Leap

一款原创的单关卡浏览器平台跳跃游戏。玩家需要穿越余烬古城，收集 12 枚星辉、避开尖刺并越过两类敌人，最终抵达星门。

## 操作

- 移动：`A` / `D` 或左右方向键
- 跳跃：`W`、上方向键或空格
- 暂停：`Esc`
- 重新开始：`R`
- 手机：屏幕左右移动按钮与跳跃按钮支持同时按住；横屏视野更开阔

## 本地运行

```bash
npm install
npm run dev
```

## 验证

```bash
npm test
npm run lint
npx tsc --noEmit
npm run test:rendered
```

游戏由 React 界面、固定步长 TypeScript 模拟与 Canvas 2D 渲染器组成。记录和音效偏好仅保存在当前设备；场景、角色、敌人、像素素材与分享图均为本项目原创资产。

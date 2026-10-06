# 本机推荐与短测

main 创建 `HardwareService({app,nativeTheme,systemPreferences,readContext,onShown,onPerformance})`。read(savedGraphics) 读取 Node totalmem/availableParallelism；GPU 只取 `getGPUFeatureStatus().gpu_compositing` 白名单结果，basic 查询有 1.5 秒上限，完整型号/驱动对象不保留、不转发。双 GPU 不按型号猜性能；失败/超时返回 unknown。软件合成或≤4GiB 建议 smooth，其余 balanced；大内存与高核数不能自动 high。保存的 custom 和手选不会自动改变。

`beginSample(graphics)` 返回一次性 ticket；renderer 稳定 2 秒、采样 8 秒，仅保留最多 4096 个 rAF 回调间隔。取消、隐藏、失焦、尺寸/DPR/系统偏好变化即丢弃；main 用实际窗口/屏幕上下文再次核验，所有 window/screen/system 事件调用 checkContext()，避免发生变化再恢复后掩盖失效。renderer 结束只向 main 提交固定直方图/p95 摘要，逐帧数组释放；main 对收集器仅记录白名单粗档。它不是屏幕呈现 FPS，不关闭后台节流。

finishSample(ticket,summary) 只有实际 effectiveGraphics 是完整 high、硬件合成、RAM>4GiB、有效样本≥240、p95≤20ms、>50ms 比例≤1% 时建议 high；其他质量的优秀样本不能外推 high。结果显示实际窗口尺寸/DPR/效果与有效性；性能报告区分保存组合与系统减少动态/透明后的生效组合。

recommendation token 仅留 main 短期观察表 30 分钟/128 项，绑定显示器与 DPR；换屏/重启不能继续有效采用。renderer 只能把建议应用到画面草稿，经原 settings.apply 保存成功再统计采用。真正进入可见区域后由 IntersectionObserver 调用 presentRecommendation(token) 计展示，读取或构造建议不会计展示。main 先 validateAdoption(token,savedGraphics)，成功后 markAdopted 与 stats.recordRecommendation(token,'adopted',graphics)；统计 epoch 的分母配对由 TelemetryService 独立校验。建议跨 epoch 可以应用，但不会补记无展示分母的采用。

官方依据：[GPUFeatureStatus](https://www.electronjs.org/docs/latest/api/structures/gpu-feature-status/)、[app GPU 查询](https://www.electronjs.org/docs/latest/api/app)、[nativeTheme 减少透明](https://www.electronjs.org/docs/latest/api/native-theme)、[systemPreferences.getAnimationSettings](https://www.electronjs.org/docs/latest/api/system-preferences)。没有假设不存在的 nativeTheme reduced-motion 属性。

```sh
node --test game/desktop/hardware/test.cjs
```

已通过保守推荐、GPU 超时/失败、实际 high 条件、非 high 不外推、取消与上下文变更边界单测；真实本机读取和可见场景短测由普通 main Electron 验证单独登记。Kimi 未调用。

普通 main 实测 macOS / 16GiB / 可用并行度 8 / hardware；1366×768、1000×650、请求 1000×1000（桌面实际限制 1000×994）再回 1366×768，DPR 始终 2，没有跨 DPR 证据。设置 smoke-3 成功取消/实际 resize 失效/可见短测（482 间隔、p95 17.6ms），真实 collector GUI-4 另完成有效采样并只上传一份白名单粗报告。后来 smoke-4/5 的失焦/上下文失效如实失败保留，没有改断言或凑后台样本。设置页独立左右滚动与菜单框无文档级溢出已实际检查；其他屏幕/DPR/OS 未运行。

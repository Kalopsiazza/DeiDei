# R04-T03-a 遗留核对与实际终态

2026-10-04。精确起点 `1f30a2449dddbe98144b7e98e0dc0a8e76b977ca`；候选产品 `edbb85a664bde73bc74160f00bb38e15d5634908`。里程碑一完成，二／三未完成。状态使用工作单规定的六种值；具体 run／输入／失败边界见 [REPORT](REPORT.md)。

| 原要求 | 实际入口／当前实现 | 已有证据与本次处理 | 完成状态 |
|---|---|---|---|
| 预览身份与同场去重 | 普通main每次new FixturePort；模块级新场次序号，同场去重保留 | P1 clean completion14；winner→defeat→draw→winner及重复回执正确 | 已修并验证 |
| Modal关闭竞态 | preview／未保存设置；同步closing／inert、最新callback | 真实GUI键盘与迟延成功／失败；14项通过。额外240ms内busy翻转回归仍待补 | 已修并验证 |
| 开发监听／来源 | dev watcher；fixture仍加载于main，需完整build／restart | 实际MOCK dev与普通main运行，README给真实service命令及边界 | 已验证可用 |
| 共用尺寸与动画终点 | arena实际marker＋ResizeObserver；共享安全边、实际welcome DOM | 最小33牌／连续resize／出牌终点有真实几何；物理过程缺口仍阻碍全包接受 | 未完成 |
| 下限与更小空间 | native outer1000×682、content1000×650／DPR2；CDP1000×560 | P2自动10路线189记录PASS；页尾关闭可达并返回；不宣称移动端 | 已修并验证 |
| 每家族持续resize／转场／原生过程 | 欢迎、菜单设置、prepare、solo、archive、tutorial、local-result、dialog均实际路径 | P2自动路线PASS；设置整页偏移曾FAIL，短路径／重跑未复现，owner未知；拖窗／全屏往返未完成 | 未完成 |
| 真实worker／本机联机链路 | ordinarymain＋真实worker；owned CLI回环service＋合成peer | 单人实际运行；固定6/3/4/5/2每场下一拍／结果／返回15流程PASS；完整动态联机仍未验收 | 未完成 |
| 2／6全动态、3／4／5拥挤揭晓、6观战 | 共享BattleStage／真实service | 旧partial六人／viewer及各人数固定流成立；最新完整动态按REPORT保留FAIL，不能合并成全覆盖 | 未完成 |
| 房间时限当拍／后拍 | 真实select与Apply；current30s、accepted/deadline保持，policy20s／rev+1 | O7 opening／Apply／after均selecting，未到后拍；原生popup／键盘另验 | 未完成 |
| 七态／反例拒绝 | 真实角色button／card／tabs／input／select／dialog，各控件按JSX适用 | 八代表四态＋真实业务pending、禁用；五反例自检仍拒绝；页面覆写及部分busy未补齐，见CONTROL-STATES | 未完成 |
| 减少动态／透明度 | welcome／battle／dialog及prepare扫描 | P2自动路线真实CDP偏好与状态推进通过 | 已修并验证 |
| 欢迎历史人物／视频交接 | fresh、同dev重播、P01、设置返回、真实reload | P1 clean37checks／11segments PASS，正常清理；历史偶发人物异常未复现，不称找到根因 | 本轮未复现 |
| 旧两人复用严重停顿 | 同host按6/3/4/5后2固定窗口调查 | 有界RAF／trace复现长帧；P2移除局部全屏backdrop，晚揭晓改善但选卡仍重；native焦点false，解锁后继续 | 未完成 |
| 1920图鉴固定滚动长帧 | ordinarymain，双区各8wheel±500／180ms，DPR2／native焦点true | 历史严格对照列表p95 265.8→17.7，详情250.6→17.5；处理进产品，最终P2严格聚焦重测未做 | 未完成 |
| 当前双屏往返 | MateStation X与内建屏实际在线，均DPR2 | 硬件具备；Mac锁屏阻碍实际拖屏，不能归为缺设备；无完整录屏 | 未完成 |
| 不同DPI／物理4K／缩放 | 当前双屏同DPR2 | 需不同DPR／实际4K模式及系统缩放实测；自动超大窗口单列模拟，见REPORT步骤 | 缺少具体条件 |
| Windows／干净机／新玩家 | 当前可调用host是macOS本机 | 需Windows图形host、干净机器／账户及真人安排；具体短流程和接受点已给 | 缺少具体条件 |
| 新包／成包GUI／信任／物理断网／跨设备公网 | 旧ZIP仍0a37a89，独立发行／设备验收 | 未打新包；需本轮同SHA新包、第二电脑及公网TLS条件，按REPORT交接 | 缺少具体条件 |
| 最终build／checks／CI／增量PR／证据 | P2产品／最终H QA和文档；base #34源分支 | 实际build、76Node、59Python及guards，图片／JSON入库；CI按远端H读回，0项不是PASS；全包接受仍未完成 | 未完成 |
| AI强度／本地时限、多身份、音源新增 | 现有产品能力边界 | 保留独立需求，本包无新增 | 另行开发 |

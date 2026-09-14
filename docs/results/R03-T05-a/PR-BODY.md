## 这次想解决什么

旧R02打包stage缺R03在线模块。新增独立原生构建，从只读固定产品SHA生成带离线worker的客户端与冻结room-server，并验证实际成包联机。

## 改了什么

仅game/packaging_r03、具名r03-native-diagnostic.yml及本结果目录：精确stage/require链、候选回执校验、双平台锁、双SHA、许可/架构/ZIP清单与真实窗口驱动。当前固定T04候选d0c96408；受测工具325006a2。产品/规则/模型/旧打包/旧CI和现有依赖版本未修改；独立环境加入现有websockets17.0.1。

## 怎样验证

8项工具负例通过。最终原生CI run 34909293225双端success：各5场真实成包联机、10次启动/单人/退出；时限精确不变与后续生效、第三缺席移出、房主离开、服务重启身份失效、服务持续停止后的离线单人、损坏worker/catalog及缺server路径全部通过。两视口三排33牌有真实截图。两端依赖审计无high/critical；最终内部artifact实际下载，内外hash及macOS341项/Windows250项清单通过。

## 已知问题与边界

候选首轮Windows在损坏副本复制区间退出127，原证据保留为失败；外部工具改用旧R02的Python标准库复制后，一次复测双端通过。未放宽产品断言。旧基线-7ms失败单独保留。

macOS ad-hoc、未公证且spctl rejected；Windows未签名。原生CI不代表真人/干净机/物理断网或公网通过。未合并、部署或发布Release。重点自审完成；未调用Kimi（暂停）。

## 提交者确认

- [x] 仅授权路径；二进制、凭证、私人档案不入Git。
- [x] 基线、候选首轮失败、最终通过分开记录。
- [x] 保留Windows原始CRLF证据，换行告警独立记录。

[最终CI](https://github.com/Kalopsiazza/DeiDei/actions/runs/34909293225)；下载与完整SHA见docs/results/R03-T05-a/DOWNLOADS.md。

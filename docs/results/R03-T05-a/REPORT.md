# R03-T05-a 原生候选成包验证

当前状态：PACKAGED_AUTOMATION_PASS（macOS arm64、Windows x64）。两端使用任务04同一固定候选，在原生CI构建并重新展开最终ZIP，以真实成包Electron、独立冻结server和正常协议peer完成验证。不是公网发行或真人/干净机验收。

## 固定来源

- 产品 source_sha：d0c96408a3aa8c14174099da4247bcac953fb9f7。
- T04回执提交：db51a442d0f6640ce499ffbf4320c7098044cb92，具名分支codex/r03-t04-a-live-integration，回执stage为integrated_local_pass。已验证schema、提交祖先关系、受保护core/runtime树及依赖锁。
- 最终受测工具 packaging_sha：325006a2fd17f9beaa5ee68ae0142da01986806f。后续报告提交不冒充重新构建。
- 最终CI run：34909293225（workflow_dispatch），macOS job 104192975845、Windows job 104192976064，均success。
- PR #26：codex/r03-t05-a-native-diagnostic → integration/r03-live。规划仍为a1e01ee259c65d9241ad1c4daee7852faca366bf。

## 本次续跑与实际结果

更新提交内candidate-input；外部驱动在服务重启身份失效后停止冻结服务，等待退出，再做离线单人和十次开退，补齐Q22环境条件。产品目录、旧打包、旧CI和依赖版本未修改。

候选首轮run 34908825587、工具d6fea37637af543542c1f7f1218c24427f24707a：macOS通过；Windows已经完成5场、10次开退，但在损坏副本复制区间无JS异常退出127，原报告停留RUNNING，必须按CI失败解释。没有Windows候选artifact上传。证据见candidate/attempt-1-*。

将Windows的Node fs.cpSync替换为旧R02验证工具已有的专用Python shutil.copytree，加入复制/启动阶段记录后，仅做一次有实质改动的复测，两端全部通过。这将问题收敛到外部复制路径；未声称已诊断Node/OS原生退出的内部根因。候选各平台共2次构建；基线历史另列，不混算为候选通过。

最终两端各完成5场真实联机、10次启动/离线单人/离开/退出；验证当前拍deadline精确不变、下一拍时限生效、普通玩家第三缺席移出、房主after_turn离开无伪胜者、服务重启身份恢复失败。冻结服务持续停止时离线worker仍可用；缺worker/catalog显示“游戏文件不完整”，缺server得到ENOENT，不下载或回退MOCK。1366×768及1920×1080均三排33牌，真实截图已查看。Q21—Q24的本包自动验证通过。

8项工具检查在本地和两端CI通过；语法检查通过。原根检查40项、1个历史expectedFailure属于基线工具交付记录，续跑不冒称重新执行全仓测试；T04回执中的产品检查为其提供的证据。两端执行时npm全部/runtime审计无high/critical，固定Python依赖PyPI公告为空。

最终包实际下载及内外hash/build-info/清单复核见DOWNLOADS.md、downloads.json。Mac在本机以ditto再次展开并核验权限/链接/架构；Windows下载后验证250项原始字节，Windows原生架构检查由runner完成。

## 签名、边界和历史

macOS为ad-hoc、未公证，CI中codesign验证通过，spctl明确rejected；Windows客户端/server的Authenticode状态为NotSigned。没有关闭防护或修改系统安全设置。普通用户/干净机系统信任、真人、物理断网、公网/异地均NOT_RUN。

旧8a6f8b2基线的Windows -7ms失败、macOS诊断成绩及下载记录原样保留于REPORT-BASELINE、TEST-MATRIX-BASELINE、ci-macos、ci-windows和downloads-baseline.json。不能把候选通过回写成基线通过。

原生Windows文本CRLF保留原字节，diff换行告警独立记录于DIFF-CHECK.json；源码/CI检查无告警。只交付授权的独立工具与证据，无产品规则/模型/依赖变化，无合入、发布或部署。已重点自审；未调用Kimi（暂停）。

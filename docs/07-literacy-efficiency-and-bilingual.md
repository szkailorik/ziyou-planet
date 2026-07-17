# 识字效率、双语语义桥与字族设计

## 1. 产品结论

“快速识字”不等于催孩子点得更快。系统把效率拆成三项：认得准、换语境和隔天仍认得、在正确基础上逐渐自动化。儿童端不显示倒计时和排名，家长端才展示客观正确率、无提示正确反应时中位数及达到自动化证据的字数。

中文识字是主任务。英文和字族都属于答后增强层：先让孩子只看汉字独立回忆，提交后才出现中文词句、英文语义桥和审核过的结构规律。三类信息不会泄露当前题目的答案，也不计入中文掌握度。

## 2. 为什么用准确率 + 稳定性 + 速度

中文阅读流畅性研究通常同时涉及准确与速度，而不是只看完成时间。系统因此使用：

1. 客观正确率；
2. 最近正确无提示反应的中位时间；
3. 跨题型、跨语境、跨日期的稳定证据。

参考：[Cognitive Correlates of Reading Fluency in Chinese Children](https://pmc.ncbi.nlm.nih.gov/articles/PMC7287183/)；[The relationship between reading fluency and comprehension in Chinese](https://pmc.ncbi.nlm.nih.gov/articles/PMC9783447/)。

3 秒和 6 秒是产品初始阈值，不是儿童能力常模。上线数据只用于同一儿童的纵向趋势；未来若调整必须升级 `ruleVersion` 并能从事件重算。

## 3. 自适应短复习：先读音，再语境

一次“我会读”的自评只用于快速定位，不能直接算作稳定掌握。进入复习后，系统按每个字缺少的证据选择题型：

1. 还没有正确读音证据：显示汉字，四选一辨读音；
2. 已能辨读音但缺少迁移证据：把目标字从已审核的生活句中遮住，四选一放回句子；
3. 两类证据都有：在后续到期复习中交替出现，避免只记住一种题面。

这样客观练习与掌握规则保持一致，不会出现“孩子一直答读音题，但状态永远无法稳定”的断路。队列优先级为到期、正在形成、初次接触、基本掌握；稳定掌握的字不占用当轮时间。每轮最多 12 个字，答对后短暂显示词句、字族与可选文化线索，约 1.25 秒自动进入下一题；答错时保留反馈和手动继续，给孩子足够时间重新编码。

设计依据是间隔练习、主动提取与区分“已经会/还需学习”的原则；小学儿童从提取练习中获益时也需要清晰、短小的引导。参考：[What Works Clearinghouse: Organizing Instruction and Study to Improve Student Learning](https://ies.ed.gov/ncee/wwc/PracticeGuide/1)；[Computer-Based Guided Retrieval Practice for Elementary School Children](https://ies.ed.gov/use-work/awards/computer-based-guided-retrieval-practice-elementary-school-children)。

## 4. 英文应该在哪里出现

中英双语阅读存在部分语音层面的跨语言关联，但字形加工强烈依赖书写系统本身。因此英文不在汉字呈现和作答前出现，避免把翻译线索当成“认出汉字”。参考：[Development of phonological processing in Chinese–English bilingual children](https://pubmed.ncbi.nlm.nih.gov/16139587/)。

英文必须绑定中文词义，而不是强行“一字一译”。例如：

- `月亮 → moon`、`月份 → month`，而不是简单写 `月 = moon`；
- `日子 → day`、`生日 → birthday`；
- 功能字、明显多义字没有可靠词义桥时不显示。

英文语义桥默认可用，家长可关闭；不设英文答题、不改变中文分数。混合语言和新词学习可能产生竞争或语境依赖，所以首版保持短、确定、答后出现，不在同一屏加入英文句子和额外测验。参考：[Cross-language competition in novel word learning](https://pmc.ncbi.nlm.nih.gov/articles/PMC11227099/)；[Learning words in mixed-language contexts](https://pmc.ncbi.nlm.nih.gov/articles/PMC11118227/)。

## 5. 字族识字的价值与位置

字族有明确价值：儿童从低年级起逐步发展对汉字结构、形旁位置/语义类别和声旁读音线索的认识；这些知识与汉字阅读和句子理解有关。研究也支持声旁和形旁参与汉字字形学习与自我教学。参考：[A “Radical” Approach to Reading Development in Chinese](https://journals.sagepub.com/doi/10.1207/s15548430jlr3503_3)；[Semantic and Phonological Decoding in Children's Orthographic Learning in Chinese](https://eric.ed.gov/?id=EJ1303106)；[Chinese orthographic learning systematic review and meta-analysis](https://www.polyu.edu.hk/fh/research/research-output/journal-articles/what-is-chinese-orthographic-learning-via-self-teaching/)。

但首版不单开主分支，原因是：

- 系统首要目标仍是测出并扩大实际可认字量；
- 声旁只给线索，不保证现代普通话读音完全相同；
- 形近字一次出现过多会让初学儿童把“似曾相识”误报成“认识”。

当前实现把少量人工审核字族放在答后反馈和字册详情，例如 `青—清—请—情—晴—睛`。界面明确标注“结构迁移，不是读音答案”，突出当前字，并用词义部件解释差别。

P1 可以增加自适应“字族小侦探”，但只有满足以下条件才出现：该字族至少 2 个成员已有基础掌握；每次只引入 1 个新成员；必须用词语/句子做辨析；专项成绩单独记录，不直接提升单字掌握状态。这样字族是加速迁移工具，而不是替代逐字测量的捷径。

## 6. 家长入口

固定算术题已移除。首次进入家长中心要设置本机 6 位数字 PIN，使用 PBKDF2-SHA-256 和随机盐保存摘要；连续 5 次错误后锁定 60 秒。PIN 保护报告、设置和数据操作，但浏览器本地应用的家长门不等同于服务器账户认证；家庭云同步仍使用独立的云端 PIN 和高熵同步码。

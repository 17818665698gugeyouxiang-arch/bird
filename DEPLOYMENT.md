# 飞鸟游戏部署

- 仓库：https://github.com/17818665698gugeyouxiang-arch/bird
- 网站：https://17818665698gugeyouxiang-arch.github.io/bird/
- 分支：master
- 发布源：GitHub Actions
- 工作流：.github/workflows/deploy-pages.yml

## 更新

修改根目录 index.html、cloud.js、supabase-config.js。执行：

```sh
node tests/verify.cjs
node tests/cloud.cjs
node scripts/build.cjs
git add index.html cloud.js supabase-config.js tests scripts .github README.md DEPLOYMENT.md .gitignore
git commit -m "Update game"
git push origin master
```

工作流测试后复制 3 个公开文件到 dist，再发布 dist。不上传备份、模拟数据、临时部署文件或私密凭据。不需要购买服务器。部署源保持 GitHub Actions。

## Supabase

项目：https://wevmotwnnzknfclloeyh.supabase.co
公开配置：supabase-config.js，只有 publishable key。

复用现有 auth-login、auth-signup 函数；不部署或替换旧函数、不修改旧数据表。新注册账号沿用旧账号体系，可能由旧项目现有触发器建立玩家资料，但飞鸟代码不写入肘肘猪游戏存档和联机数据。

最高分保存在当前登录用户的 user_metadata.bird_best_score。通过用户自己的访问令牌读取 /auth/v1/user，并仅更新 bird_best_score 字段。Supabase 校验令牌所属用户，不使用管理员密钥，不查询其他玩家。不部署数据库迁移。

登录成功后同步；每局结束、恢复联网、返回标签页或点击“同步”时重试。待同步记录按用户 ID 独立保存在本机。网络出错不影响本地游戏。更新元数据会合并字段；不会替换肘肘猪用户名等信息。个人最高分由客户端提交，不能用作可信排行榜；跨设备并发更新不是原子 max，需避免同账号同时游玩，切换前确认同步成功。

现有函数允许的 ALLOWED_ORIGINS 已包含 https://17818665698gugeyouxiang-arch.github.io，路径 /bird/ 和 /bijie/ 共用该 Origin。若以后更换域名，应在控制台追加域名，保留旧项目域名。

## 云端故障

2026-09-27 最初因原项目暂停导致域名不可用；用户在控制台点 Resume 后项目已恢复，Auth 返回 200。实际验证通过：新账号注册、登录、仅写入 bird_best_score、第二次登录后读取相同最高分，既有元数据字段保持不变。用于验证的测试账号为 cwkubgumwg，最高分 7，两次测试会话均已退出；未删除任何玩家，测试账号未保存密码。若将来再次暂停，在 Supabase 控制台恢复原项目，勿删除重建。

- GitHub Pages 不依赖 Supabase，云端故障期间仍可玩。
- 不需要提供 GitHub token、数据库密码或 service_role key 给前端。
- 官网说明：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- 账号数据说明：https://supabase.com/docs/guides/auth/managing-user-data

## 本次验收

GitHub Actions 首次部署运行 36323334367 成功；线上 3 个发布文件与本地源码一致（忽略换行编码）。22 项游戏检查及云同步专项检查通过。浏览器已验证线上启动、边界失败结算、重新开局资金重置，以及登录面板显示；真实账号接口的注册和跨会话读写另行验证通过。

如本机 Git 直连超时，而 Windows 已配置本地代理，可为单次命令指定当前实际代理。不要把代理地址或 token 写入仓库。

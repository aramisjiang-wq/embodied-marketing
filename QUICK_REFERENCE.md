# 🚀 Embodied Marketing - 快速参考卡片

> **一页纸精华版 | 日常开发运维必备**

---

## 📋 项目配置速查

| 配置项 | 值 |
|--------|-----|
| **GitHub 仓库** | `aramisjiang-wq/embodied-marketing` |
| **服务器地址** | `root@101.200.222.139` |
| **部署路径** | `/opt/embodied-marketing` |
| **服务端口** | `8082` |
| **PM2 进程名** | `embodied-marketing` |
| **访问地址** | http://101.200.222.139:8082/login |

---

## 🔄 标准部署流程（5步）

### **Step 1: 本地提交**
```bash
cd "/Users/dong/Downloads/Codebase/LimX Code/Embodied Marketing"
git status                          # 查看修改
git add <files>                     # 添加文件
git commit -m "type(scope): 描述"   # 提交
```

### **Step 2: 推送 GitHub**
```bash
git push origin main                # 正常推送
```
⚠️ **网络失败？** → 用 Patch 方案（见下方）

### **Step 3: 更新服务器**
```bash
sshpass -p 'XLj4kUnh' ssh root@101.200.222.139 \
  "cd /opt/embodied-marketing && git pull origin main"
```

### **Step 4: 构建重启**
```bash
sshpass -p 'XLj4kUnh' ssh root@101.200.222.139 \
  "cd /opt/embodied-marketing && rm -rf .next && \
   npm run build && pm2 restart embodied-marketing"
```

### **Step 5: 验证**
```bash
open "http://101.200.222.139:8082/login"
```

---

## 🔧 备选方案：Patch 部署（网络问题时）

### **本地创建 Patch**
```bash
git format-patch -1 HEAD --stdout > /tmp/update.patch
sshpass -p 'XLj4kUnh' scp /tmp/update.patch \
  root@101.200.222.139:/opt/embodied-marketing/
```

### **服务器应用 Patch**
```bash
sshpass -p 'XLj4kUnh' ssh root@101.200.222.139 \
  "cd /opt/embodied-marketing && \
   git am --3way /opt/embodied-marketing/update.patch"
```

---

## 🔙 回滚操作

### **软回滚（推荐）- 保留历史**
```bash
# 本地
git revert HEAD
git push origin main

# 服务器同步
sshpass -p 'XLj4kUnh' ssh root@101.200.222.139 \
  "cd /opt/embodied-marketing && git pull origin main && \
   npm run build && pm2 restart embodied-marketing"
```

### **硬回滚 - 彻底丢弃**
```bash
git reset --hard HEAD~1                    # 回退1个commit
git push --force origin main               # 强制推送

# 服务器执行相同操作
sshpass -p 'XLj4kUnh' ssh root@101.200.222.139 \
  "cd /opt/embodied-marketing && \
   git reset --hard origin/main && \
   npm run build && pm2 restart embodied-marketing"
```

### **回滚到指定版本**
```bash
git log --oneline -10                      # 查看历史
git reset --hard <commit-hash>             # 回退到指定版本
```

### **从 GitHub 恢复本地代码**
```bash
git checkout -- .                          # 放弃本地修改
git clean -fd                              # 清理未跟踪文件
git fetch origin                           # 拉取最新
git reset --hard origin/main              # 重置到远程版本
```

---

## ⚡ 常用命令速查

### **Git 操作**
| 操作 | 命令 |
|------|------|
| 查看状态 | `git status` |
| 查看差异 | `git diff` |
| 查看日志 | `git log --oneline -10` |
| 添加所有 | `git add .` |
| 提交 | `git commit -m "msg"` |
| 推送 | `git push origin main` |
| 拉取 | `git pull origin main` |

### **服务器运维**
| 操作 | 命令 |
|------|------|
| SSH 登录 | `sshpass -p 'XLj4kUnh' ssh root@101.200.222.139` |
| PM2 状态 | `pm2 list` |
| PM2 日志 | `pm2 logs embodied-marketing --lines 50` |
| PM2 重启 | `pm2 restart embodied-marketing` |
| PM2 停止 | `pm2 stop embodied-marketing` |
| 健康检查 | `curl http://localhost:8082/api/system-status` |

### **一键部署脚本**
```bash
# 使用项目自带的部署脚本
./bilibili-monitor/scripts/deploy-production.sh        # 完整部署
./bilibili-monitor/scripts/deploy-production.sh --dry-run  # 模拟运行
./bilibili-monitor/scripts/deploy-production.sh --skip-db   # 跳过数据库
```

---

## 📝 Commit Message 规范

```
格式: <type>(<scope>): <subject>

类型:
  feat     新功能
  fix      bug修复
  docs     文档更新
  style    格式调整
  refactor 重构
  perf     性能优化
  test     测试相关
  chore    构建/工具

示例:
  feat(login): add Suspense wrapper for loading UX
  fix(auth): resolve session timeout issue
  docs(readme): update deployment instructions
```

---

## 🆘 故障排查

### **问题：推送时 SSL 错误**
→ 使用 **Patch 方案**（见上方）

### **问题：构建失败 TypeScript 错误**
```bash
# 服务器上执行
rm -rf .next node_modules/.cache
npm install
npm run build
```

### **问题：PM2 启动失败**
```bash
pm2 logs embodied-marketing --err --lines 50   # 查看错误日志
lsof -i :8082                                 # 检查端口占用
cat /opt/embodied-marketing/.env.local         # 检查环境变量
```

### **问题：服务端 500 错误**
```bash
# 查看实时日志
pm2 logs embodied-marketing

# 检查最近部署
cd /opt/embodied-marketing && git log --oneline -3
```

---

## ✅ 部署前检查清单

- [ ] 本地测试通过 (`npm run dev`)
- [ ] 代码已提交 (`git status` 干净)
- [ ] 已推送到 GitHub (或准备 patch)
- [ ] 记录当前 commit hash (用于回滚)
- [ ] 选择非高峰时段部署
- [ ] 准备好回滚方案

---

## 💡 最佳实践

### **开发习惯**
✅ 小步快跑，频繁提交（每完成一个小功能就 commit）
❌ 避免大量修改一次性提交

### **分支策略（可选）**
```bash
git checkout -b feature/new-feature    # 创建功能分支
# ... 开发 ...
git push origin feature/new-feature    # 推送分支
git checkout main && git merge feature/new-feature  # 合并到主分支
```

### **定期维护（每周）**
```bash
# 检查服务器健康状态
sshpass -p 'XLj4kUnh' ssh root@101.200.222.139 << 'EOF'
pm2 list
df -h /opt
free -h
EOF
```

---

## 📞 关键路径速记

```
本地开发 → git commit → git push → 服务器 git pull → npm run build → pm2 restart → 验证

紧急回滚:
  • git revert HEAD (软回滚)
  • git reset --hard HEAD~1 (硬回滚)
  • 服务器: git reset --hard <稳定hash>

网络问题:
  • git format-patch → scp → git am
```

---

**📅 最后更新**: 2026-05-10  
**👤 维护者**: Deploy Bot  
**🔗 GitHub**: https://github.com/aramisjiang-wq/embodied-marketing

---

*💡 打印此文档并放在桌面上，随时快速查阅！*

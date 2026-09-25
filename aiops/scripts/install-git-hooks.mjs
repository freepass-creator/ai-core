/** 현재 clone/worktree에서 버전 관리되는 hooks를 활성화한다. */
import { execFileSync } from 'node:child_process';
execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
process.stdout.write('Git hooks path: .githooks\n');

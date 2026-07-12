const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../app.js');
let appContent = fs.readFileSync(appPath, 'utf8');

// Define showContestLeaderboardModal globally before target block
const modalFunc = `
function showContestLeaderboardModal(leaderboardData, contestProblems) {
    const modal = document.createElement("div");
    modal.id = "leaderboard-modal";
    modal.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(10, 10, 12, 0.85); display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 2rem; backdrop-filter: blur(8px);";
    
    modal.innerHTML = \`
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; width: 100%; max-width: 900px; max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); padding: 2.25rem 2rem 2rem 2rem; position: relative;">
            <!-- Close button -->
            <button onclick="document.getElementById('leaderboard-modal').remove()" style="position: absolute; top: 1.25rem; right: 1.25rem; background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='var(--accent-red)'" onmouseout="this.style.color='var(--text-muted)'"><i class="fa-solid fa-xmark"></i></button>
            
            <h3 style="font-size: 1.3rem; font-weight:700; border-bottom:1px solid var(--border-color); padding-bottom:1rem; margin-bottom: 1.25rem; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
                <i class="fa-solid fa-ranking-star" style="color:var(--accent-orange);"></i> Bảng Thành Tích Kỳ Thi
            </h3>

            <!-- Legend -->
            <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; font-size: 0.8rem; color: var(--text-secondary); background: rgba(255,255,255,0.01); padding: 0.75rem; border-radius: 8px; border:1px solid var(--border-color);">
                <div style="display:flex; align-items:center; gap:0.35rem;"><span style="width:12px; height:12px; border-radius:3px; background:#10b981;"></span> Đúng (Có điểm)</div>
                <div style="display:flex; align-items:center; gap:0.35rem;"><span style="width:12px; height:12px; border-radius:3px; background:#fbbf24;"></span> Đang chấm (Pending)</div>
                <div style="display:flex; align-items:center; gap:0.35rem;"><span style="width:12px; height:12px; border-radius:3px; background:#f43f5e;"></span> Làm sai</div>
            </div>

            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-secondary); font-size: 0.82rem;">
                            <th style="padding: 0.75rem;">STT</th>
                            <th style="padding: 0.75rem;">Username</th>
                            <th style="padding: 0.75rem;">Họ và tên</th>
                            <th style="padding: 0.75rem; text-align: center;">Tổng điểm</th>
                            \${contestProblems.map((p, idx) => \`<th style="padding: 0.75rem; text-align: center;">Câu \${idx+1}</th>\`).join("")}
                        </tr>
                    </thead>
                    <tbody>
                        \${leaderboardData.length === 0 ? \`
                            <tr>
                                <td colspan="\${4 + contestProblems.length}" style="text-align:center; padding: 2rem; color: var(--text-muted); font-style:italic;">
                                    Chưa có thí sinh nào đăng ký tham gia kỳ thi này.
                                </td>
                            </tr>
                        \` : leaderboardData.map((data, idx) => \`
                            <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.01)'" onmouseout="this.style.background='none'">
                                <td style="padding: 0.75rem;">\${idx + 1}</td>
                                <td style="padding: 0.75rem; font-weight:600; color:var(--accent-blue);">\${data.user.mssv || (data.user.email ? data.user.email.split('@')[0] : 'N/A')}</td>
                                <td style="padding: 0.75rem;">\${data.user.name}</td>
                                <td style="padding: 0.75rem; text-align: center; font-weight:700; color:var(--text-primary);">\${data.totalPoints}</td>
                                \${data.problemStatuses.map(status => {
                                    let bg = 'none';
                                    let color = 'inherit';
                                    let text = '-';
                                    if (status.status === 'correct') {
                                        bg = '#10b981';
                                        color = '#ffffff';
                                        text = 'Đúng';
                                    } else if (status.status === 'pending') {
                                        bg = '#fbbf24';
                                        color = '#1e293b';
                                        text = 'Chờ';
                                    } else if (status.status === 'incorrect') {
                                        bg = '#f43f5e';
                                        color = '#ffffff';
                                        text = 'Sai';
                                    }
                                    return \`<td style="padding: 0.75rem; text-align: center;">
                                        \${text !== '-' ? \`<span style="background:\${bg}; color:\${color}; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:600;">\${text}</span>\` : '-'}
                                    </td>\`;
                                }).join("")}
                            </tr>
                        \`).join("")}
                    </tbody>
                </table>
            </div>
        </div>
    \`;
    document.body.appendChild(modal);
}
`;

// Insert modal helper before target boot section
const targetBootString = '// ─── 7. BOOT ──────────────────────────────────────────────────────────────────';
appContent = appContent.replace(targetBootString, modalFunc + '\n' + targetBootString);

// Replace the leaderboard container in viewContestDetail with a button and register the listener
const oldLeaderboardBlock = `            <!-- LEADERBOARD / BẢNG THÀNH TÍCH -->
            <div class="card" style="margin-top: 1.5rem;">
                <h3 style="font-size: 1.15rem; font-weight:700; border-bottom:1px solid var(--border-color); padding-bottom:0.75rem; margin-bottom: 1rem; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
                    <i class="fa-solid fa-ranking-star" style="color:var(--accent-orange);"></i> Bảng Thành Tích Kỳ Thi
                </h3>

                <!-- Legend -->
                <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; font-size: 0.8rem; color: var(--text-secondary); background: rgba(255,255,255,0.01); padding: 0.75rem; border-radius: 8px; border:1px solid var(--border-color);">
                    <div style="display:flex; align-items:center; gap:0.35rem;"><span style="width:12px; height:12px; border-radius:3px; background:#10b981;"></span> Đúng (Có điểm)</div>
                    <div style="display:flex; align-items:center; gap:0.35rem;"><span style="width:12px; height:12px; border-radius:3px; background:#fbbf24;"></span> Đang chấm (Pending)</div>
                    <div style="display:flex; align-items:center; gap:0.35rem;"><span style="width:12px; height:12px; border-radius:3px; background:#f43f5e;"></span> Làm sai</div>
                </div>

                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-secondary); font-size: 0.82rem;">
                                <th style="padding: 0.75rem;">STT</th>
                                <th style="padding: 0.75rem;">Username</th>
                                <th style="padding: 0.75rem;">Họ và tên</th>
                                <th style="padding: 0.75rem; text-align: center;">Tổng điểm</th>
                                \${contestProblems.map((p, idx) => \`<th style="padding: 0.75rem; text-align: center;">Câu \${idx+1}</th>\`).join("")}
                            </tr>
                        </thead>
                        <tbody>
                            \${leaderboardData.length === 0 ? \`
                                <tr>
                                    <td colspan="\${5 + contestProblems.length}" style="text-align:center; padding: 2rem; color: var(--text-muted); font-style:italic;">
                                        Chưa có thí sinh nào đăng ký tham gia kỳ thi này.
                                    </td>
                                </tr>
                            \` : leaderboardData.map((data, idx) => \`
                                <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.01)'" onmouseout="this.style.background='none'">
                                    <td style="padding: 0.75rem;">\${idx + 1}</td>
                                    <td style="padding: 0.75rem; font-weight:600; color:var(--accent-blue);\${data.user.mssv || (data.user.email ? data.user.email.split('@')[0] : 'N/A')}</td>
                                    <td style="padding: 0.75rem;">\${data.user.name}</td>
                                    <td style="padding: 0.75rem; text-align: center; font-weight:700; color:var(--text-primary);\${data.totalPoints}</td>
                                    \${data.problemStatuses.map(status => {
                                        let bg = 'none';
                                        let color = 'inherit';
                                        let text = '-';
                                        if (status.status === 'correct') {
                                            bg = '#10b981';
                                            color = '#ffffff';
                                            text = 'Đúng';
                                        } else if (status.status === 'pending') {
                                            bg = '#fbbf24';
                                            color = '#1e293b';
                                            text = 'Chờ';
                                        } else if (status.status === 'incorrect') {
                                            bg = '#f43f5e';
                                            color = '#ffffff';
                                            text = 'Sai';
                                        }
                                        return \`<td style="padding: 0.75rem; text-align: center;">
                                            \${text !== '-' ? \`<span style="background:\${bg}; color:\${color}; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:600;">\${text}</span>\` : '-'}
                                        </td>\`;
                                    }).join("")}
                                </tr>
                            \`).join("")}
                        </tbody>
                    </table>
                </div>
            </div>`;

// Wait, the search template needs to match exact spacing and code in app.js
// Let's do a regex replacement in node script to be safe
const oldLeaderboardRegex = /<!-- LEADERBOARD \/ BẢNG THÀNH TÍCH -->[\s\S]*?<\/table>\s*<\/div>\s*<\/div>/;

const newLeaderboardBlock = `
            <!-- LEADERBOARD TRIGGER BUTTON -->
            <div style="margin-top: 1.5rem; display: flex; justify-content: center;">
                <button id="view-contest-leaderboard-btn" class="btn btn-primary" style="background: linear-gradient(135deg, #f59e0b, #d97706); border: none; color: white; display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.75rem; font-size: 0.95rem; font-weight: 600; border-radius: 8px; box-shadow: var(--shadow-sm); cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='none'">
                    <i class="fa-solid fa-ranking-star"></i> Xem Bảng Thành Tích Kỳ Thi
                </button>
            </div>
`;

const appContentLF = appContent.replace(/\r\n/g, '\n');

if (oldLeaderboardRegex.test(appContentLF)) {
    let replaced = appContentLF.replace(oldLeaderboardRegex, newLeaderboardBlock);
    
    // Register the button listener inside viewContestDetail function right before renderLaTeX
    const targetRenderLaTeX = `        renderLaTeX(mainContent);
    } catch (e) {
        showError("Không thể tải kỳ thi!");
    }
}`;

    const newRenderLaTeX = `        // Register leaderboard modal listener
        document.getElementById("view-contest-leaderboard-btn")?.addEventListener("click", () => {
            showContestLeaderboardModal(leaderboardData, contestProblems);
        });

        renderLaTeX(mainContent);
    } catch (e) {
        showError("Không thể tải kỳ thi!");
    }
}`;

    replaced = replaced.replace(targetRenderLaTeX, newRenderLaTeX);

    fs.writeFileSync(appPath, replaced, 'utf8');
    console.log("Successfully replaced inline leaderboard with a modal trigger button");
} else {
    console.log("Failed to find inline leaderboard template block using regex");
}

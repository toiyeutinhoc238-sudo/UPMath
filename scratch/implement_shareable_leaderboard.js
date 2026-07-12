const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../app.js');
let appContent = fs.readFileSync(appPath, 'utf8');

// 1. Remove openContestLeaderboardWindow definition
const oldWindowFunc = `function openContestLeaderboardWindow(leaderboardData, contestProblems, contestTitle) {
    const newWindow = window.open("", "_blank");
    if (!newWindow) {
        showToast("Vui lòng cho phép trình duyệt mở popup để xem bảng thành tích!", "error");
        return;
    }

    const problemHeaders = contestProblems.map((p, idx) => \`<th style="padding: 12px; text-align: center; border-bottom: 1px solid #1f2937;">Câu \${idx+1}</th>\`).join("");

    const rows = leaderboardData.length === 0 ? \`
        <tr>
            <td colspan="\${4 + contestProblems.length}" style="text-align:center; padding: 32px; color:#9ca3af; font-style:italic;">
                Chưa có thí sinh nào đăng ký tham gia kỳ thi này.
            </td>
        </tr>
    \` : leaderboardData.map((data, idx) => {
        const username = data.user.mssv || (data.user.email ? data.user.email.split('@')[0] : 'N/A');
        const cells = data.problemStatuses.map(status => {
            let bg = 'transparent';
            let color = '#e2e8f0';
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
            return \`<td style="padding: 12px; text-align: center; border-bottom: 1px solid #1f2937;">
                \${text !== '-' ? \`<span style="background:\${bg}; color:\${color}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">\${text}</span>\` : '-'}
            </td>\`;
        }).join("");

        return \`
            <tr style="border-bottom: 1px solid #1f2937; transition: background 0.2s;">
                <td style="padding: 12px; border-bottom: 1px solid #1f2937; color:#e2e8f0;">\${idx + 1}</td>
                <td style="padding: 12px; font-weight: 600; color: #6366f1; border-bottom: 1px solid #1f2937;">\${username}</td>
                <td style="padding: 12px; border-bottom: 1px solid #1f2937; color: #e2e8f0;">\${data.user.name}</td>
                <td style="padding: 12px; text-align: center; font-weight: 700; color: #f59e0b; border-bottom: 1px solid #1f2937;">\${data.totalPoints}</td>
                \${cells}
            </tr>
        \`;
    }).join("");

    const htmlContent = \`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <title>Bảng Thành Tích - \${contestTitle}</title>
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                body {
                    margin: 0;
                    padding: 2rem;
                    background-color: #0b0f19;
                    color: #f8fafc;
                    font-family: 'Outfit', sans-serif;
                }
                .container {
                    max-width: 1000px;
                    margin: 0 auto;
                    background: #111827;
                    border: 1px solid #1f2937;
                    border-radius: 16px;
                    padding: 2rem;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #1f2937;
                    padding-bottom: 1.25rem;
                    margin-bottom: 1.5rem;
                }
                .legend {
                    display: flex;
                    gap: 1rem;
                    flex-wrap: wrap;
                    margin-bottom: 1.5rem;
                    font-size: 0.85rem;
                    color: #9ca3af;
                    background: #1f2937;
                    padding: 0.75rem 1rem;
                    border-radius: 8px;
                }
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 0.35rem;
                }
                .dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 3px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                    font-size: 0.95rem;
                }
                th {
                    color: #9ca3af;
                    font-weight: 600;
                    font-size: 0.85rem;
                    text-transform: uppercase;
                }
                tr:hover {
                    background: rgba(255, 255, 255, 0.02);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <img src="logo.png" style="height: 32px;" />
                        <span style="font-weight: 800; font-size: 1.45rem; color: #ffffff; letter-spacing: -0.5px; font-family: 'Outfit', sans-serif;">UP<span style="color: #6366f1;">Math</span></span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; color: #9ca3af; font-weight: 500; font-size: 0.95rem; background: rgba(255,255,255,0.03); padding: 0.4rem 0.85rem; border-radius: 20px; border: 1px solid #1f2937;">
                        <i class="fa-solid fa-ranking-star" style="color: #f59e0b;"></i>
                        <span>\${contestTitle}</span>
                    </div>
                </div>

                <div class="legend">
                    <div class="legend-item"><span class="dot" style="background:#10b981;"></span> Đúng (Có điểm)</div>
                    <div class="legend-item"><span class="dot" style="background:#fbbf24;"></span> Đang chấm (Pending)</div>
                    <div class="legend-item"><span class="dot" style="background:#f43f5e;"></span> Làm sai</div>
                </div>

                <div style="overflow-x: auto;">
                    <table>
                        <thead>
                            <tr>
                                <th style="padding: 12px; border-bottom: 1px solid #1f2937;">STT</th>
                                <th style="padding: 12px; border-bottom: 1px solid #1f2937;">Username</th>
                                <th style="padding: 12px; border-bottom: 1px solid #1f2937;">Họ và tên</th>
                                <th style="padding: 12px; text-align: center; border-bottom: 1px solid #1f2937;">Tổng điểm</th>
                                \${problemHeaders}
                            </tr>
                        </thead>
                        <tbody>
                            \${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        </body>
        </html>
    \`;

    newWindow.document.write(htmlContent);
    newWindow.document.close();
}`;

// 2. Define viewStandaloneLeaderboard
const newStandaloneLeaderboardFunc = `
async function viewStandaloneLeaderboard(contestId) {
    // Overwrite page HTML structure to render ONLY the leaderboard cleanly
    document.body.innerHTML = \`
        <div style="display:flex; justify-content:center; align-items:center; min-height:100vh; background:#0b0f19; color:#f8fafc; font-family:'Outfit',sans-serif; padding:2rem;">
            <div id="standalone-leaderboard-container" style="width:100%; max-width:1000px; background:#111827; border:1px solid #1f2937; border-radius:16px; padding:2rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);">
                <div style="text-align:center; padding:3rem;">
                    <i class="fa-solid fa-spinner fa-spin fa-2x" style="color:var(--accent-orange);"></i>
                    <p style="margin-top:1rem; color:#9ca3af;">Đang tải bảng thành tích...</p>
                </div>
            </div>
        </div>
    \`;

    try {
        const contests = await api.getContests();
        const c = contests.find(item => item._id === contestId);
        if (!c) {
            document.getElementById("standalone-leaderboard-container").innerHTML = \`
                <div style="text-align:center; padding:2rem; color:#f43f5e;">
                    <i class="fa-solid fa-circle-exclamation fa-2x"></i>
                    <p style="margin-top:1rem;">Không tìm thấy kỳ thi!</p>
                </div>\`;
            return;
        }

        const problems = await api.getProblems();
        const contestProblems = problems.filter(p => p.contestId === contestId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        const allSolutions = [];
        for (let p of contestProblems) {
            try {
                const sols = await api.getSolutions(p._id);
                allSolutions.push(...sols);
            } catch (err) {
                console.error(err);
            }
        }

        const users = await api.getUsers();
        const participantUsers = users.filter(u => c.participants && c.participants.includes(u.googleId));

        const leaderboardData = participantUsers.map(u => {
            let totalPoints = 0;
            const problemStatuses = contestProblems.map(p => {
                const userSols = allSolutions.filter(s => s.problemId === p._id && s.authorGoogleId === u.googleId);
                const correctSol = userSols.find(s => s.status === 'correct');
                const pendingSol = userSols.find(s => s.status === 'pending');
                const incorrectSol = userSols.find(s => s.status === 'incorrect');

                if (correctSol) {
                    totalPoints += p.points || 10;
                    return { status: 'correct', sol: correctSol };
                } else if (pendingSol) {
                    return { status: 'pending', sol: pendingSol };
                } else if (incorrectSol) {
                    return { status: 'incorrect', sol: incorrectSol };
                }
                return { status: 'none', sol: null };
            });

            return {
                user: u,
                problemStatuses,
                totalPoints
            };
        }).sort((a, b) => b.totalPoints - a.totalPoints);

        const problemHeaders = contestProblems.map((p, idx) => \`<th style="padding: 12px; text-align: center; border-bottom: 1px solid #1f2937; color: #9ca3af; font-weight: 600; font-size: 0.85rem; text-transform: uppercase;">Câu \${idx+1}</th>\`).join("");

        const rows = leaderboardData.length === 0 ? \`
            <tr>
                <td colspan="\${4 + contestProblems.length}" style="text-align:center; padding: 32px; color:#9ca3af; font-style:italic;">
                    Chưa có thí sinh nào đăng ký tham gia kỳ thi này.
                </td>
            </tr>
        \` : leaderboardData.map((data, idx) => {
            const username = data.user.mssv || (data.user.email ? data.user.email.split('@')[0] : 'N/A');
            const cells = data.problemStatuses.map(status => {
                let bg = 'transparent';
                let color = '#e2e8f0';
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
                return \`<td style="padding: 12px; text-align: center; border-bottom: 1px solid #1f2937;">
                    \${text !== '-' ? \`<span style="background:\${bg}; color:\${color}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">\${text}</span>\` : '-'}
                </td>\`;
            }).join("");

            return \`
                <tr style="border-bottom: 1px solid #1f2937; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.01)'" onmouseout="this.style.background='none'">
                    <td style="padding: 12px; border-bottom: 1px solid #1f2937; color:#e2e8f0;">\${idx + 1}</td>
                    <td style="padding: 12px; font-weight: 600; color: #6366f1; border-bottom: 1px solid #1f2937;">\${username}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #1f2937; color: #e2e8f0;">\${data.user.name}</td>
                    <td style="padding: 12px; text-align: center; font-weight: 700; color: #f59e0b; border-bottom: 1px solid #1f2937;">\${data.totalPoints}</td>
                    \${cells}
                </tr>
            \`;
        }).join("");

        document.getElementById("standalone-leaderboard-container").innerHTML = \`
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1f2937; padding-bottom: 1.25rem; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <img src="logo.png" style="height: 32px;" />
                    <span style="font-weight: 800; font-size: 1.45rem; color: #ffffff; letter-spacing: -0.5px; font-family: 'Outfit', sans-serif;">UP<span style="color: #6366f1;">Math</span></span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; color: #9ca3af; font-weight: 500; font-size: 0.95rem; background: rgba(255,255,255,0.03); padding: 0.4rem 0.85rem; border-radius: 20px; border: 1px solid #1f2937;">
                    <i class="fa-solid fa-ranking-star" style="color: #f59e0b;"></i>
                    <span>\${c.title}</span>
                </div>
            </div>

            <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; font-size: 0.85rem; color: #9ca3af; background: #1f2937; padding: 0.75rem 1rem; border-radius: 8px;">
                <div style="display:flex; align-items:center; gap:0.35rem;"><span style="width:12px; height:12px; border-radius:3px; background:#10b981;"></span> Đúng (Có điểm)</div>
                <div style="display:flex; align-items:center; gap:0.35rem;"><span style="width:12px; height:12px; border-radius:3px; background:#fbbf24;"></span> Đang chấm (Pending)</div>
                <div style="display:flex; align-items:center; gap:0.35rem;"><span style="width:12px; height:12px; border-radius:3px; background:#f43f5e;"></span> Làm sai</div>
            </div>

            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.95rem;">
                    <thead>
                        <tr>
                            <th style="padding: 12px; border-bottom: 1px solid #1f2937; color: #9ca3af; font-weight: 600; font-size: 0.85rem; text-transform: uppercase;">STT</th>
                            <th style="padding: 12px; border-bottom: 1px solid #1f2937; color: #9ca3af; font-weight: 600; font-size: 0.85rem; text-transform: uppercase;">Username</th>
                            <th style="padding: 12px; border-bottom: 1px solid #1f2937; color: #9ca3af; font-weight: 600; font-size: 0.85rem; text-transform: uppercase;">Họ và tên</th>
                            <th style="padding: 12px; text-align: center; border-bottom: 1px solid #1f2937; color: #9ca3af; font-weight: 600; font-size: 0.85rem; text-transform: uppercase;">Tổng điểm</th>
                            \${problemHeaders}
                        </tr>
                    </thead>
                    <tbody>
                        \${rows}
                    </tbody>
                </table>
            </div>
        \`;
    } catch (err) {
        document.getElementById("standalone-leaderboard-container").innerHTML = \`
            <div style="text-align:center; padding:2rem; color:#f43f5e;">
                <i class="fa-solid fa-circle-exclamation fa-2x"></i>
                <p style="margin-top:1rem;">Lỗi tải dữ liệu!</p>
            </div>\`;
    }
}
`;

appContent = appContent.replace(oldWindowFunc.replace(/\r\n/g, '\n'), newStandaloneLeaderboardFunc.replace(/\r\n/g, '\n'));

// 3. Register route in router()
const oldRouteBlock = `async function router() {
    const hash = window.location.hash || "#home";`;

const newRouteBlock = `async function router() {
    const hash = window.location.hash || "#home";
    
    // Standalone contest leaderboard route
    if (hash.startsWith("#contest/") && hash.endsWith("/leaderboard")) {
        const parts = hash.split("/");
        const contestId = parts[1];
        await viewStandaloneLeaderboard(contestId);
        return;
    }`;

appContent = appContent.replace(oldRouteBlock.replace(/\r\n/g, '\n'), newRouteBlock.replace(/\r\n/g, '\n'));

// 4. Update view-contest-leaderboard-btn listener to open URL hash
const oldListener = `        // Register leaderboard modal listener
        document.getElementById("view-contest-leaderboard-btn")?.addEventListener("click", () => {
            openContestLeaderboardWindow(leaderboardData, contestProblems, c.title);
        });`;

const newListener = `        // Register leaderboard modal listener
        document.getElementById("view-contest-leaderboard-btn")?.addEventListener("click", () => {
            window.open(\`#contest/\${id}/leaderboard\`, "_blank");
        });`;

appContent = appContent.replace(oldListener.replace(/\r\n/g, '\n'), newListener.replace(/\r\n/g, '\n'));

fs.writeFileSync(appPath, appContent, 'utf8');
console.log("Successfully implemented shareable and reloadable contest leaderboard route");

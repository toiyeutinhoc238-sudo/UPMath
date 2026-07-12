const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../app.js');
let appContent = fs.readFileSync(appPath, 'utf8');

// 1. Remove contest-question-box from viewContests() list cards
const oldViewContestsHtml = `                    <div class="card contest-list-card" onclick="window.location.hash='#contest/\${c._id}'" style="margin-bottom:1.5rem;padding:1.5rem;border-left:4px solid \${c.status === 'running' ? 'var(--accent-green)' : c.status === 'upcoming' ? 'var(--accent-blue)' : 'var(--text-muted)'}; cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-md)';" onmouseout="this.style.transform='none'; this.style.boxShadow='none';">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 1rem;">
                            <div>
                                <h3 style="font-size:1.15rem;margin-bottom:0.4rem;font-weight:700;color:var(--text-primary);\${c.title}</h3>
                                <div style="font-size:0.85rem;color:var(--text-muted);display:flex;gap:1.25rem;">
                                    <span><i class="fa-solid fa-clock"></i> <strong>Thời lượng:</strong> \${c.duration}</span>
                                    <span><i class="fa-solid fa-calendar"></i> <strong>Bắt đầu:</strong> \${c.startTime}</span>
                                </div>
                            </div>
                            <span class="badge \${c.status === 'running' ? 'badge-calculus' : c.status === 'upcoming' ? 'badge-algebra' : 'badge-tag'}">
                                \${c.status === 'running' ? '🔴 Đang diễn ra' : c.status === 'upcoming' ? '⏳ Sắp diễn ra' : '✅ Đã kết thúc'}
                            </span>
                        </div>
                        
                        <div class="contest-question-box" style="background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
                            \${c.status === 'upcoming' 
                                ? \`<div style="color: var(--text-muted); font-style: italic; display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;">
                                       <i class="fa-solid fa-lock" style="color: var(--accent-orange);"></i> Nội dung đề thi được bảo mật và sẽ tự động mở khi kỳ thi bắt đầu.
                                   </div>\`
                                : \`
                                   <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; font-size: 0.82rem; color: var(--text-muted); border-bottom: 1px dashed var(--border-color); padding-bottom: 0.5rem;">
                                       <span><strong>Môn học:</strong> \${c.category === 'calculus' ? 'Giải tích' : 'Đại số tuyến tính'} | <strong>Độ khó:</strong> \${c.difficulty === 'easy' ? 'Dễ' : c.difficulty === 'medium' ? 'Trung bình' : c.difficulty === 'hard' ? 'Khó' : 'Cực khó'}</span>
                                       <span style="color: var(--accent-blue); font-weight: 700;">\${c.points} Điểm</span>
                                   </div>
                                   <div style="line-height: 1.7; font-size: 0.95rem; word-break: break-word; display: flex; flex-direction: column; gap: 0.85rem;">
                                       \${c.questions && c.questions.length > 0 
                                           ? c.questions.map((q, idx) => \`
                                               <div style="background: rgba(255,255,255,0.015); padding: 0.85rem; border-radius: 6px; border-left: 3px solid var(--accent-orange); border-top: 1px solid var(--border-color); border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">
                                                   <strong style="color: var(--accent-orange); display: block; margin-bottom: 0.35rem; font-size: 0.9rem;">Câu \${idx + 1}:</strong>
                                                   <div style="line-height: 1.65;">\${preprocessLaTeX(q)}</div>
                                               </div>
                                             \`).join("")
                                           : \`<div>\${preprocessLaTeX(c.content || "")}</div>\`
                                       }
                                   </div>
                                   \${c.tags && c.tags.length > 0 ? \`
                                   <div style="margin-top: 0.75rem; display: flex; gap: 0.4rem; flex-wrap: wrap;">
                                       \${c.tags.map(t => \`<span class="tag-badge">#\${t}</span>\`).join("")}
                                   </div>\` : ''}
                                   \${c.gradingRubric ? \`
                                   <div style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px dashed var(--border-color); font-size: 0.85rem; color: var(--text-secondary);">
                                       <strong style="color: var(--accent-orange);"><i class="fa-solid fa-circle-info"></i> Thang điểm chi tiết (Rubric):</strong>
                                       <div style="margin-top: 0.25rem; white-space: pre-wrap; line-height: 1.6;">\${preprocessLaTeX(c.gradingRubric)}</div>
                                   </div>\` : ''}
                                  \`
                            }
                        </div>
                        
                        <div style="margin-top: 1rem; display: flex; justify-content: flex-end; border-top: 1px dashed var(--border-color); padding-top: 0.75rem;">
                            <span style="color: var(--accent-blue); font-size: 0.82rem; font-weight: 600; display: flex; align-items: center; gap: 0.35rem;">
                                Xem chi tiết &amp; Đăng ký tham gia <i class="fa-solid fa-arrow-right-long"></i>
                            </span>
                        </div>
                    </div>`;

// Since we have exact map template, let's replace it with a clean card without the inner contest-question-box
const newViewContestsHtml = `                    <div class="card contest-list-card" onclick="window.location.hash='#contest/\${c._id}'" style="margin-bottom:1.5rem;padding:1.5rem;border-left:4px solid \${c.status === 'running' ? 'var(--accent-green)' : c.status === 'upcoming' ? 'var(--accent-blue)' : 'var(--text-muted)'}; cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-md)';" onmouseout="this.style.transform='none'; this.style.boxShadow='none';">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <div>
                                <h3 style="font-size:1.15rem;margin-bottom:0.4rem;font-weight:700;color:var(--text-primary);">\${c.title}</h3>
                                <div style="font-size:0.85rem;color:var(--text-muted);display:flex;gap:1.25rem;">
                                    <span><i class="fa-solid fa-clock"></i> <strong>Thời lượng:</strong> \${c.duration}</span>
                                    <span><i class="fa-solid fa-calendar"></i> <strong>Bắt đầu:</strong> \${c.startTime}</span>
                                </div>
                            </div>
                            <div style="display:flex; gap:0.75rem; align-items:center;">
                                <span class="badge \${c.status === 'running' ? 'badge-calculus' : c.status === 'upcoming' ? 'badge-algebra' : 'badge-tag'}">
                                    \${c.status === 'running' ? '🔴 Đang diễn ra' : c.status === 'upcoming' ? '⏳ Sắp diễn ra' : '✅ Đã kết thúc'}
                                </span>
                                <span style="color: var(--accent-blue); font-size: 0.82rem; font-weight: 600; display: flex; align-items: center; gap: 0.35rem;">
                                    Xem chi tiết <i class="fa-solid fa-arrow-right-long"></i>
                                </span>
                            </div>
                        </div>
                    </div>`;

// Replace using loose/safe comparison
const oldViewContestsHtmlLF = oldViewContestsHtml.replace(/\r\n/g, '\n');
const appContentLF = appContent.replace(/\r\n/g, '\n');

if (appContentLF.includes(oldViewContestsHtmlLF)) {
    appContent = appContentLF.replace(oldViewContestsHtmlLF, () => newViewContestsHtml.replace(/\r\n/g, '\n'));
    console.log("Successfully removed questions box from list view");
} else {
    // Fallback: search for c.questions loop in viewContests
    console.log("Direct template replace failed, trying loose search");
    const looseRegex = /: contests\.map\(c => `\s*<div class="card contest-list-card"[\s\S]*?<\/div>\s*<\/div>\`\)\.join\(""\)}/;
    if (looseRegex.test(appContentLF)) {
        appContent = appContentLF.replace(looseRegex, `: contests.map(c => \`\n${newViewContestsHtml.replace(/\r\n/g, '\n')}\`).join("")}`);
        console.log("Loose search replaced successfully!");
    } else {
        console.log("Loose search failed");
    }
}

// 2. Update viewContestDetail(id) in app.js:
// Check isRegistered before rendering contest questions
const oldDetailQuestionsBlock = `                \\\${c.status === 'upcoming' ? \\\`
                    <div class="contest-question-box" style="background: rgba(255,255,255,0.02); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); text-align: center; color: var(--text-muted);">
                        <i class="fa-solid fa-lock fa-3x" style="color: var(--accent-orange); margin-bottom: 1rem;"></i>
                        <p style="font-size: 1rem; font-weight:600;">Nội dung đề thi được bảo mật và sẽ tự động mở khi kỳ thi chính thức bắt đầu.</p>
                        \\\${!isRegistered && me ? '<p style="font-size: 0.88rem; margin-top:0.5rem;">Hãy đăng ký để tham gia và nhận email thông báo khi đề thi mở!</p>' : ''}
                    </div>
                \\\` : \\\`
                    <div class="contest-question-box" style="background: rgba(255,255,255,0.01); padding: 1.25rem; border-radius: 8px; border: 1px solid var(--border-color);">
                        <h4 style="font-size: 1rem; font-weight:700; color:var(--accent-blue); margin-bottom: 0.75rem;"><i class="fa-solid fa-file-invoice"></i> Đề thi chính thức:</h4>
                        
                        <div style="display:flex; flex-direction:column; gap:1rem; margin-bottom: 1.25rem;">
                            \\\${contestProblems.map((p, idx) => \\\`
                                <div style="background: rgba(255,255,255,0.015); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color); border-left: 4px solid var(--accent-orange);">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                                        <span style="font-weight:700; color:var(--accent-orange);">Câu \\\${idx+1}</span>
                                        \\\${isRegistered ? \\\`
                                            <a href="#problem/\\\${p._id}" class="btn btn-secondary btn-xs" style="padding:0.25rem 0.5rem; font-size:0.75rem; border-radius:6px;"><i class="fa-solid fa-pen-to-square"></i> Làm bài này</a>
                                        \\\` : '<span style="font-size:0.75rem; color:var(--text-muted);">Đăng ký để làm bài</span>'}
                                    </div>
                                    <div style="line-height:1.75; font-size:0.95rem;">
                                        \\\${preprocessLaTeX(p.content)}
                                    </div>
                                </div>
                            \\\`).join("")}
                        </div>
                    </div>
                \\\`}`;

const newDetailQuestionsBlock = `                \\\${!isRegistered ? \\\`
                    <div class="contest-question-box" style="background: rgba(255,255,255,0.02); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); text-align: center; color: var(--text-muted);">
                        <i class="fa-solid fa-user-lock fa-3x" style="color: var(--accent-orange); margin-bottom: 1rem;"></i>
                        <p style="font-size: 1.05rem; font-weight:600; color: var(--text-primary);">Đề thi đã bị khóa</p>
                        <p style="font-size: 0.88rem; margin-top:0.5rem; color: var(--text-secondary);">Bạn cần nhấn nút <strong>Đăng ký tham gia</strong> ở phía trên để có quyền xem đề thi và làm bài.</p>
                    </div>
                \\\` : (c.status === 'upcoming' ? \\\`
                    <div class="contest-question-box" style="background: rgba(255,255,255,0.02); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border-color); text-align: center; color: var(--text-muted);">
                        <i class="fa-solid fa-lock fa-3x" style="color: var(--accent-orange); margin-bottom: 1rem;"></i>
                        <p style="font-size: 1rem; font-weight:600;">Nội dung đề thi được bảo mật và sẽ tự động mở khi kỳ thi chính thức bắt đầu.</p>
                    </div>
                \\\` : \\\`
                    <div class="contest-question-box" style="background: rgba(255,255,255,0.01); padding: 1.25rem; border-radius: 8px; border: 1px solid var(--border-color);">
                        <h4 style="font-size: 1rem; font-weight:700; color:var(--accent-blue); margin-bottom: 0.75rem;"><i class="fa-solid fa-file-invoice"></i> Đề thi chính thức:</h4>
                        
                        <div style="display:flex; flex-direction:column; gap:1rem; margin-bottom: 1.25rem;">
                            \\\${contestProblems.map((p, idx) => \\\`
                                <div style="background: rgba(255,255,255,0.015); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color); border-left: 4px solid var(--accent-orange);">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                                        <span style="font-weight:700; color:var(--accent-orange);">Câu \\\${idx+1}</span>
                                        <a href="#problem/\\\${p._id}" class="btn btn-secondary btn-xs" style="padding:0.25rem 0.5rem; font-size:0.75rem; border-radius:6px;"><i class="fa-solid fa-pen-to-square"></i> Làm bài này</a>
                                    </div>
                                    <div style="line-height:1.75; font-size:0.95rem;">
                                        \\\${preprocessLaTeX(p.content)}
                                    </div>
                                </div>
                            \\\`).join("")}
                        </div>
                    </div>
                \\\`)}`;

const oldDetailQuestionsBlockLF = oldDetailQuestionsBlock.replace(/\r\n/g, '\n');
const appContentLF2 = appContent.replace(/\r\n/g, '\n');
if (appContentLF2.includes(oldDetailQuestionsBlockLF)) {
    appContent = appContentLF2.replace(oldDetailQuestionsBlockLF, () => newDetailQuestionsBlock.replace(/\r\n/g, '\n'));
    console.log("Successfully added isRegistered check inside viewContestDetail");
} else {
    // loose search for detail block
    console.log("Detail block replace failed, trying loose search");
    const looseRegex2 = /\\\${c\.status === 'upcoming' \? \\\`[\s\S]*?<\/div>\s*\\\`\s*}/;
    if (looseRegex2.test(appContentLF2)) {
        appContent = appContentLF2.replace(looseRegex2, newDetailQuestionsBlock.replace(/\r\n/g, '\n'));
        console.log("Detail block loose search replaced successfully!");
    } else {
        console.log("Detail block loose search failed");
    }
}

fs.writeFileSync(appPath, appContent, 'utf8');
console.log("Completed lock contest questions updates");

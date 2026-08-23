const refinementStyles=document.createElement('link');refinementStyles.rel='stylesheet';refinementStyles.href='./refinements.css?v=20260823-8';document.head.appendChild(refinementStyles);const headerCta=document.querySelector('.header-cta');if(headerCta)headerCta.remove();const primaryExplore=document.querySelector('.hero-actions .button-primary');if(primaryExplore)primaryExplore.innerHTML='开始探索 <span aria-hidden="true">↗</span>';

const timeAnchorCard=document.querySelector('.project-grid .project-card');
if(timeAnchorCard){
  timeAnchorCard.className='project-card project-real project-time-anchor project-template';
  timeAnchorCard.innerHTML=`
    <div class="project-template-top">
      <h3 class="project-title-zh">时间锚 <small>Time Anchor</small></h3>
      <div class="project-badges" aria-label="项目状态"><span class="project-badge badge-open">开源</span><span class="project-badge badge-pick">✦ 人工精选</span></div>
    </div>
    <div class="project-hook-row"><p class="project-problem">让 TA 知道：你离开了多久。</p><span class="project-author">@See-Sol-Lab</span></div>
    <p class="project-description">给 AI 一只表，让真实时间间隔参与下一次回应。它关心的是“间隔感”，不是机械报时。</p>
    <div class="project-tags"><span>时间感</span><span>连续性</span><span>Codex</span><span>Claude Code</span></div>
    <div class="project-card-footer"><div class="project-footer-meta"><span>Python</span><span>PC 优先</span><span>更新 2026-08-21</span></div><a class="project-detail-button" href="./projects/time-anchor/">查看详情 <span>→</span></a></div>`;
}

const cardTemplateStyles=document.createElement('style');cardTemplateStyles.textContent=`
.project-template{position:relative;display:flex;flex-direction:column;min-height:292px!important;border-color:rgba(91,109,178,.24)!important;background:radial-gradient(circle at 92% 5%,rgba(170,139,235,.14),transparent 32%),linear-gradient(150deg,rgba(255,255,255,.94),rgba(249,247,252,.88))!important}
.project-template-top{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:12px}
.project-title-zh{margin:0!important;font-family:var(--serif)!important;font-size:30px!important;line-height:1.05!important;font-weight:500!important;letter-spacing:-.025em!important;color:#132347!important}
.project-title-zh small{display:inline-block;margin-left:10px!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",Arial,sans-serif!important;font-size:13px!important;font-weight:600!important;line-height:1.2!important;letter-spacing:.025em!important;color:#7281a0!important;vertical-align:middle;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.project-badges{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;flex:none}
.project-badge{display:inline-flex;align-items:center;min-height:26px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:650;white-space:nowrap}
.badge-open{color:#286d63;background:rgba(77,171,151,.11);border:1px solid rgba(77,171,151,.18)}
.badge-pick{color:#5b54a8;background:rgba(135,116,219,.1);border:1px solid rgba(135,116,219,.16)}
.project-hook-row{display:flex;align-items:baseline;justify-content:space-between;gap:18px;margin-bottom:13px}
.project-problem{margin:0!important;color:#526b9f!important;font-size:15px!important;font-weight:750!important;letter-spacing:.01em}
.project-author{flex:none;margin:0!important;color:#7483a3!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",Arial,sans-serif!important;font-size:12px!important;font-weight:600!important;line-height:1.3!important;letter-spacing:.015em!important;white-space:nowrap;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.project-description{margin:0!important;color:#687795!important;font-size:14px!important;line-height:1.78!important}
.project-template .project-tags{margin-top:20px!important}
.project-template .project-tags span{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",Arial,sans-serif!important;font-size:10px!important;font-weight:500!important;letter-spacing:.01em!important;padding:6px 10px!important;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.project-card-footer{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:auto;padding-top:18px;border-top:1px solid rgba(72,91,137,.12)}
.project-footer-meta{display:flex;align-items:center;flex-wrap:wrap;gap:9px;color:#6f7f9f;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",Arial,sans-serif;font-size:12px;font-weight:500;line-height:1.35;letter-spacing:.01em;font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.project-footer-meta span:not(:last-child):after{content:'·';margin-left:9px;color:#aeb8c9}
.project-detail-button{display:inline-flex;align-items:center;justify-content:center;gap:11px;min-height:42px;padding:0 18px;border-radius:10px;color:white;background:linear-gradient(100deg,#567fe1,#7a72df 60%,#9c69da);box-shadow:0 8px 20px rgba(92,96,196,.18);font-size:13px;font-weight:700;transition:.2s;white-space:nowrap}
.project-detail-button:hover{transform:translateY(-1px);box-shadow:0 12px 26px rgba(92,96,196,.24)}
.project-template .project-symbol,.project-template .project-stars,.project-template .project-external-link,.project-template .project-meta{display:none!important}
@media(max-width:820px){.project-template-top,.project-hook-row{align-items:flex-start;flex-direction:column}.project-badges{justify-content:flex-start}.project-title-zh{font-size:27px!important}.project-title-zh small{font-size:13px!important}.project-author{font-size:12px!important}.project-card-footer{align-items:flex-start;flex-direction:column}.project-footer-meta{font-size:12px}.project-detail-button{width:100%}}
`;document.head.appendChild(cardTemplateStyles);

const menuToggle=document.getElementById('menuToggle');const mainNav=document.getElementById('mainNav');if(menuToggle&&mainNav){menuToggle.addEventListener('click',()=>{const open=mainNav.classList.toggle('open');menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'关闭导航':'打开导航')});mainNav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{mainNav.classList.remove('open');menuToggle.setAttribute('aria-expanded','false')}))}document.querySelectorAll('.tag').forEach(tag=>{tag.addEventListener('click',()=>{document.querySelectorAll('.tag').forEach(item=>item.classList.remove('active'));tag.classList.add('active')})});const visual=document.querySelector('.hero-visual');const map=document.querySelector('.atlas-map');if(visual&&map&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){visual.addEventListener('pointermove',event=>{const rect=visual.getBoundingClientRect();const x=(event.clientX-rect.left)/rect.width-.5;const y=(event.clientY-rect.top)/rect.height-.5;map.style.transform=`translate(calc(-50% + ${x*8}px),calc(-48% + ${y*8}px))`});visual.addEventListener('pointerleave',()=>{map.style.transform='translate(-50%,-48%)'})}
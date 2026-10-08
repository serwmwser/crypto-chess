import{_ as w}from"./index-BggU5D2z.js";let a;function O(f,o={}){const{qrSize:c=280,showCloseButton:g=!0,closeButtonText:m="×",theme:n="light",container:u=document.body,onCancel:k}=o;a==null||a();const t=document.createElement("div");t.style.cssText=`
    position: fixed;
    inset: 0;
    background-color: ${n==="dark"?"rgba(0, 0, 0, 0.8)":"rgba(0, 0, 0, 0.5)"};
    backdrop-filter: blur(10px);
    z-index: 9999;
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 300ms ease-out;
  `,o.overlayStyles&&Object.assign(t.style,o.overlayStyles);const i=document.createElement("div");if(i.style.cssText=`
    background: ${n==="dark"?"#1f1f1f":"#ffffff"};
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    max-width: 90vw;
    max-height: 90vh;
    position: relative;
    animation: scaleIn 300ms ease-out;
  `,o.modalStyles&&Object.assign(i.style,o.modalStyles),g){const e=document.createElement("button");e.textContent=m,e.style.cssText=`
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: ${n==="dark"?"#ffffff":"#000000"};
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: background-color 0.2s;
    `,e.addEventListener("mouseenter",()=>{e.style.backgroundColor=n==="dark"?"rgba(255, 255, 255, 0.1)":"rgba(0, 0, 0, 0.1)"}),e.addEventListener("mouseleave",()=>{e.style.backgroundColor="transparent"}),e.addEventListener("click",()=>{p(!0)}),i.appendChild(e)}const d=document.createElement("div");d.style.cssText=`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  `;const y=document.createElement("h3");y.textContent="Scan to Connect",y.style.cssText=`
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: ${n==="dark"?"#ffffff":"#000000"};
    text-align: center;
  `;const l=document.createElement("canvas");l.width=c,l.height=c,l.style.cssText=`
    border: 1px solid ${n==="dark"?"#333333":"#e5e5e5"};
    border-radius: 12px;
  `,T(f,l,c).catch(console.error);const r=document.createElement("button");r.textContent="Copy URI",r.style.cssText=`
    background: ${n==="dark"?"#333333":"#f5f5f5"};
    border: 1px solid ${n==="dark"?"#444444":"#e5e5e5"};
    color: ${n==="dark"?"#ffffff":"#000000"};
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
  `,r.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(f);const e=r.textContent;r.textContent="Copied!",setTimeout(()=>{r.textContent=e},2e3)}catch(e){console.error("Failed to copy URI:",e)}}),d.appendChild(y),d.appendChild(l),d.appendChild(r),i.appendChild(d),t.appendChild(i);const s=document.createElement("style");s.textContent=`
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @keyframes scaleIn {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    @keyframes scaleOut {
      from { transform: scale(1); opacity: 1; }
      to { transform: scale(0.9); opacity: 0; }
    }
  `,document.head.appendChild(s);const x=e=>{e.key==="Escape"&&p(!0)},h=e=>{e.target===t&&p(!0)};document.addEventListener("keydown",x),t.addEventListener("click",h),u.appendChild(t);function v(){document.removeEventListener("keydown",x),t.removeEventListener("click",h),t.remove(),s.remove(),a===v&&(a=void 0)}a=v;function p(e=!1){document.removeEventListener("keydown",x),t.removeEventListener("click",h),a===v&&(a=void 0),e&&k&&k(),t.style.animation="fadeOut 200ms ease-in",i.style.animation="scaleOut 200ms ease-in";const b=()=>{t.parentNode&&t.parentNode.removeChild(t),s.parentNode&&s.parentNode.removeChild(s)};t.addEventListener("animationend",b,{once:!0}),setTimeout(b,250)}function C(){t.style.display="none"}function E(){t.style.display="flex"}return{destroy:()=>p(!1),hide:C,show:E}}async function T(f,o,c){if(!o.getContext("2d"))return;const{toCanvas:m}=await w(async()=>{const{toCanvas:n}=await import("./browser-DrUKFQtT.js").then(u=>u.b);return{toCanvas:n}},[]);await m(o,f,{width:c,margin:2,color:{dark:"#000000",light:"#ffffff"}})}export{O as createQROverlay};

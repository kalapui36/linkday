// Handwriting centerlines in a 100 × 100 jamo box. Each entry is one pen-down
// stroke; joined corners remain a single stroke. Composite jamo retain the
// left-to-right order of their components. No font metrics are used.
(() => {
  const line = (...points) => points;
  const forms = {
    'ㄱ': [line([18,18],[82,18],[82,82])],
    'ㄴ': [line([18,18],[18,82],[82,82])],
    'ㄷ': [line([18,18],[82,18]),line([18,18],[18,82],[82,82])],
    'ㄹ': [line([18,18],[82,18],[82,50]),line([18,50],[82,50]),line([18,50],[18,82],[82,82])],
    'ㅁ': [line([18,18],[18,82]),line([18,18],[82,18],[82,82]),line([18,82],[82,82])],
    'ㅂ': [line([18,18],[18,82]),line([82,18],[82,82]),line([18,50],[82,50]),line([18,82],[82,82])],
    'ㅅ': [line([50,18],[18,82]),line([50,18],[82,82])],
    'ㅇ': ['circle'],
    'ㅈ': [line([18,18],[82,18],[18,82]),line([50,50],[82,82])],
    'ㅊ': [line([40,8],[60,8]),line([18,30],[82,30],[18,88]),line([50,59],[82,88])],
    'ㅋ': [line([18,18],[82,18],[82,82]),line([18,50],[82,50])],
    'ㅌ': [line([18,18],[82,18]),line([18,50],[82,50]),line([18,18],[18,82],[82,82])],
    'ㅍ': [line([12,18],[88,18]),line([30,18],[30,82]),line([70,18],[70,82]),line([12,82],[88,82])],
    'ㅎ': [line([40,8],[60,8]),line([16,29],[84,29]),'small-circle'],
    'ㅏ': [line([38,10],[38,90]),line([38,50],[82,50])],
    'ㅑ': [line([38,10],[38,90]),line([38,34],[82,34]),line([38,66],[82,66])],
    'ㅓ': [line([18,50],[62,50]),line([62,10],[62,90])],
    'ㅕ': [line([18,34],[62,34]),line([18,66],[62,66]),line([62,10],[62,90])],
    'ㅗ': [line([50,15],[50,65]),line([10,65],[90,65])],
    'ㅛ': [line([34,15],[34,65]),line([66,15],[66,65]),line([10,65],[90,65])],
    'ㅜ': [line([10,35],[90,35]),line([50,35],[50,90])],
    'ㅠ': [line([10,35],[90,35]),line([34,35],[34,90]),line([66,35],[66,90])],
    'ㅡ': [line([10,50],[90,50])],
    'ㅣ': [line([50,10],[50,90])]
  };
  const pairs = {'ㄲ':'ㄱㄱ','ㄸ':'ㄷㄷ','ㅃ':'ㅂㅂ','ㅆ':'ㅅㅅ','ㅉ':'ㅈㅈ','ㄳ':'ㄱㅅ','ㄵ':'ㄴㅈ','ㄶ':'ㄴㅎ','ㄺ':'ㄹㄱ','ㄻ':'ㄹㅁ','ㄼ':'ㄹㅂ','ㄽ':'ㄹㅅ','ㄾ':'ㄹㅌ','ㄿ':'ㄹㅍ','ㅀ':'ㄹㅎ','ㅄ':'ㅂㅅ','ㅐ':'ㅏㅣ','ㅒ':'ㅑㅣ','ㅔ':'ㅓㅣ','ㅖ':'ㅕㅣ','ㅘ':'ㅗㅏ','ㅙ':'ㅗㅐ','ㅚ':'ㅗㅣ','ㅝ':'ㅜㅓ','ㅞ':'ㅜㅔ','ㅟ':'ㅜㅣ','ㅢ':'ㅡㅣ'};
  const colors = ['#286bba','#a95725','#24785c'];
  const svg = document.getElementById('guide');
  const label = document.getElementById('stroke-label');
  const play = document.getElementById('play-strokes');
  const all = document.getElementById('all-strokes');
  const prev = document.getElementById('prev-stroke');
  const next = document.getElementById('next-stroke');
  const ns = 'http://www.w3.org/2000/svg';
  let entries = [], step = -1, timer = null, playing = false;
  function el(tag, attrs = {}, text) {
    const node = document.createElementNS(ns, tag);
    for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function subbox(box,x,y,w,h) { return [box[0]+x*box[2],box[1]+y*box[3],w*box[2],h*box[3]]; }
  function pathsFor(jamo, box, group) {
    if (!jamo) return [];
    if (pairs[jamo]) {
      const [left,right] = Array.from(pairs[jamo]);
      const split = 'ㅘㅙㅚㅝㅞㅟㅢ'.includes(jamo) ? .58 : .5;
      return [...pathsFor(left,subbox(box,0,0,split,1),group),...pathsFor(right,subbox(box,split,0,1-split,1),group)];
    }
    if (!forms[jamo]) throw new Error('Missing stroke guide: '+jamo);
    const point = ([x,y]) => [box[0]+x/100*box[2],box[1]+y/100*box[3]];
    return forms[jamo].map((stroke,localIndex) => {
      let d;
      if (typeof stroke === 'string') {
        const top = stroke === 'circle' ? 16 : 42;
        const bottom = 86;
        const coords = [[50,top],[6,top],[6,bottom],[50,bottom],[94,bottom],[94,top],[50,top]].map(point);
        d = 'M '+coords[0].join(' ')+' C '+coords.slice(1,4).map(p=>p.join(' ')).join(' ')+' C '+coords.slice(4).map(p=>p.join(' ')).join(' ');
      } else {
        d = stroke.map((p,i)=>(i?'L ':'M ')+point(p).join(' ')).join(' ');
      }
      return {d,group,jamo,localIndex:localIndex+1};
    });
  }
  function stop() {
    clearTimeout(timer);timer=null;playing=false;
    play.textContent='▶ 획순 보기';play.setAttribute('aria-pressed','false');
  }
  function draw() {
    svg.replaceChildren();
    const defs = el('defs');
    colors.forEach((color,i)=>{
      const marker=el('marker',{id:'arrow-'+i,viewBox:'0 0 10 10',refX:8,refY:5,markerWidth:6,markerHeight:6,orient:'auto',markerUnits:'userSpaceOnUse'});
      marker.append(el('path',{d:'M 0 0 L 9 5 L 0 10 Z',fill:color}));defs.append(marker);
    });svg.append(defs);
    entries.forEach(entry=>svg.append(el('path',{d:entry.d,class:'stroke-base'})));
    const badges=[];
    entries.forEach((entry,i)=>{
      const color=colors[entry.group],g=el('g',{'data-order':i+1,'data-jamo':entry.jamo,'data-group':entry.group,class:step!==-1&&i!==step?'stroke-muted':''});
      const route=el('path',{d:entry.d,class:'stroke-route',stroke:color});g.append(route);svg.append(g);
      const len=route.getTotalLength(),start=route.getPointAtLength(0);
      // An arrow within the final segment also works for closed circular strokes.
      const arrowPoints=Array.from({length:25},(_,k)=>route.getPointAtLength(len*(.65+.29*k/24)));
      const arrowPath=arrowPoints.map((p,k)=>`${k?'L':'M'} ${p.x} ${p.y}`).join(' ');
      g.append(el('path',{d:arrowPath,fill:'none',stroke:color,'stroke-width':2.5,'marker-end':`url(#arrow-${entry.group})`}));
      let x,y;
      const offsets=[[-10,-13],[-25,5],[-10,19],[13,-13],[13,16],[-28,-17]];
      for(const [dx,dy] of offsets){
        x=Math.max(12,Math.min(388,start.x+dx));y=Math.max(12,Math.min(388,start.y+dy));
        if(badges.every(p=>Math.hypot(p.x-x,p.y-y)>19))break;
      }
      badges.push({x,y});
      g.append(el('circle',{cx:x,cy:y,r:9,fill:color}));g.append(el('text',{x,y,class:'stroke-number'},i+1));
      if(i===step)g.insertBefore(el('path',{d:entry.d,class:'stroke-draw',stroke:color,pathLength:1}),route);
    });
    const names=['첫 자음','모음','받침'];
    label.textContent=step===-1 ? `전체 ${entries.length}획 · 1번부터 써요` : `${step+1} / ${entries.length}획 · ${names[entries[step].group]} ${entries[step].jamo}`;
    all.setAttribute('aria-pressed',String(step===-1));prev.disabled=step<=0;next.disabled=step===entries.length-1;
  }
  window.renderStrokeGuide = (initial,vowel,final) => {
    stop();step=-1;
    const hasFinal=!!final, bottom=hasFinal?250:350;
    let firstBox,vowelBox;
    if ('ㅗㅛㅜㅠㅡ'.includes(vowel)) {
      firstBox=[95,42,210,(bottom-42)*.57];
      vowelBox=[55,42+(bottom-42)*.58,290,(bottom-42)*.42];
    } else if ('ㅘㅙㅚㅝㅞㅟㅢ'.includes(vowel)) {
      firstBox=[55,42,165,(bottom-42)*.55];
      // The horizontal component sits under the first consonant; the vertical
      // component fills the right side, including the top of the syllable.
      const pair=Array.from(pairs[vowel]);
      entries=[...pathsFor(initial,firstBox,0),...pathsFor(pair[0],[45,42+(bottom-42)*.58,190,(bottom-42)*.42],1),...pathsFor(pair[1],[235,42,120,bottom-42],1),...pathsFor(final,[75,280,250,88],2)];
      draw();return;
    } else {
      firstBox=[48,48,170,bottom-48];vowelBox=[235,42,120,bottom-42];
    }
    entries=[...pathsFor(initial,firstBox,0),...pathsFor(vowel,vowelBox,1),...pathsFor(final,[75,280,250,88],2)];draw();
  };
  function advance() {
    step++;draw();
    if(step<entries.length-1)timer=setTimeout(advance,1500);else timer=setTimeout(stop,1500);
  }
  play.onclick=()=>{
    if(playing){stop();return;}
    stop();playing=true;play.textContent='⏸ 잠깐 멈춤';play.setAttribute('aria-pressed','true');step=-1;advance();
  };
  all.onclick=()=>{stop();step=-1;draw();};
  prev.onclick=()=>{stop();step=Math.max(0,step-1);draw();};
  next.onclick=()=>{stop();step=Math.min(entries.length-1,step+1);draw();};
  window.addEventListener('pagehide',stop);
})();

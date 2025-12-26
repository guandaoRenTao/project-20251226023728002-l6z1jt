/* Minimal modular calculator JS (ES6+) */
(function(){
  // Storage Manager
  const StorageManager = {
    key: 'mini-calc:settings',
    histKey: 'mini-calc:history',
    loadSettings(){
      try{const s=JSON.parse(localStorage.getItem(this.key)||'null');return Object.assign({theme:'light',precision:6},s||{});}catch(e){return {theme:'light',precision:6};}
    },
    saveSettings(s){localStorage.setItem(this.key,JSON.stringify(s));},
    loadHistory(){try{return JSON.parse(localStorage.getItem(this.histKey)||'[]')}catch(e){return []}},
    saveHistory(h){localStorage.setItem(this.histKey,JSON.stringify(h))},
    pushHistory(item){const h=this.loadHistory();h.unshift(item);h.splice(100);this.saveHistory(h)}
  };

  // Theme Manager
  const ThemeManager = {
    init(){
      this.settings=StorageManager.loadSettings();
      this.apply(this.settings.theme);
      document.getElementById('themeSwitch').addEventListener('click',()=>{this.toggle();});
    },
    apply(theme){
      document.documentElement.classList.toggle('dark',theme==='dark');
      document.getElementById('themeSwitch').setAttribute('aria-pressed', theme==='dark');
      this.settings.theme=theme;StorageManager.saveSettings(this.settings);
    },
    toggle(){this.apply(this.settings.theme==='dark'?'light':'dark');}
  };

  // Parser & Evaluator
  const ParserEvaluator = {
    ops: {
      '+':{prec:1,assoc:'L',fn:(a,b)=>a+b},
      '-':{prec:1,assoc:'L',fn:(a,b)=>a-b},
      '*':{prec:2,assoc:'L',fn:(a,b)=>a*b},
      '/':{prec:2,assoc:'L',fn:(a,b)=>{if(b===0)throw new Error('Division by zero');return a/b}}
    },
    normalize(input){return input.replace(/×/g,'*').replace(/÷/g,'/').replace(/\s+/g,'');},
    tokenize(str){
      const tokens=[];let i=0;const N=str.length;
      while(i<N){
        const ch=str[i];
        if(/\d|\./.test(ch)){
          let j=i;while(j<N && /[\d\.]/.test(str[j]))j++;
          tokens.push({type:'number',value:parseFloat(str.slice(i,j))});i=j;continue;
        }
        if(ch==='+'||ch==='-'||ch==='*'||ch==='/'){
          // handle unary minus/plus as part of number if appropriate
          const prev=tokens[tokens.length-1];
          if((ch==='+'||ch==='-') && (!prev || prev.type==='operator' || prev.type==='left_paren')){
            // unary sign: parse number after
            let j=i+1;let hasNum=false;
            while(j<N && /[0-9\.]/.test(str[j])){j++;hasNum=true}
            if(hasNum){tokens.push({type:'number',value:parseFloat(str.slice(i,j))});i=j;continue}
          }
          tokens.push({type:'operator',value:ch,precedence:this.ops[ch].prec});i++;continue;
        }
        if(ch==='('){tokens.push({type:'left_paren',value:ch});i++;continue}
        if(ch===')'){tokens.push({type:'right_paren',value:ch});i++;continue}
        throw new Error('Invalid character');
      }
      return tokens;
    },
    toPostfix(tokens){
      const out=[];const stack=[];
      for(const t of tokens){
        if(t.type==='number'){out.push(t);}
        else if(t.type==='operator'){
          const o1=t.value;while(stack.length){const top=stack[stack.length-1];
            if(top.type==='operator'){const o2=top.value;const p1=this.ops[o1].prec;const p2=this.ops[o2].prec;
              if((this.ops[o1].assoc==='L' && p1<=p2) || (this.ops[o1].assoc==='R' && p1<p2)){out.push(stack.pop());continue}
            }
            break;
          }
          stack.push(t);
        } else if(t.type==='left_paren'){stack.push(t);} else if(t.type==='right_paren'){
          let found=false;while(stack.length){const x=stack.pop();if(x.type==='left_paren'){found=true;break}else out.push(x)}
          if(!found)throw new Error('Mismatched parentheses');
        }
      }
      while(stack.length){const x=stack.pop();if(x.type==='left_paren'||x.type==='right_paren')throw new Error('Mismatched parentheses');out.push(x)}
      return out;
    },
    evalPostfix(post){
      const s=[];for(const t of post){
        if(t.type==='number')s.push(t.value);
        else if(t.type==='operator'){
          const b=s.pop();const a=s.pop();if(a===undefined||b===undefined)throw new Error('Syntax error');
          const res=this.ops[t.value].fn(a,b);if(!isFinite(res))throw new Error('Overflow');s.push(res);
        }
      }
      if(s.length!==1)throw new Error('Syntax error');return s[0];
    },
    calculate(raw){
      const normalized=this.normalize(raw);
      const tokens=this.tokenize(normalized);
      const postfix=this.toPostfix(tokens);
      const value=this.evalPostfix(postfix);
      return {expression:normalized,result:value,error:null};
    }
  };

  // Display Manager
  const Display = {
    exprEl: document.getElementById('expression'),
    resEl: document.getElementById('result'),
    showExpression(s){this.exprEl.textContent = s||'0'},
    showResult(calc){
      if(calc.error){this.resEl.textContent = calc.error;this.resEl.style.color='var(--danger)';}
      else{
        const settings=StorageManager.loadSettings();
        const p=Math.max(0,Math.min(12,settings.precision||6));
        const num=calc.result;
        let out=''+num;
        if(!Number.isInteger(num)){
          if(Math.abs(num)!==0 && (Math.abs(num)>=1e12 || Math.abs(num)<1e-6)) out=num.toExponential(p-1);
          else out=Number(num.toFixed(p));
        }
        this.resEl.style.color='';
        this.resEl.textContent = out;
      }
    }
  };

  // Input Manager
  const InputManager = {
    buffer:'',
    append(ch){
      if(this.buffer==='0' && /[0-9]/.test(ch)) this.buffer=ch; else this.buffer+=ch;
      Display.showExpression(this.buffer);
    },
    backspace(){this.buffer=this.buffer.slice(0,-1);if(this.buffer==='')this.buffer='0';Display.showExpression(this.buffer)},
    clear(){this.buffer='0';Display.showExpression(this.buffer);Display.resEl.textContent='';},
    evaluate(){
      try{
        const calc=ParserEvaluator.calculate(this.buffer);
        Display.showResult(calc);
        StorageManager.pushHistory({id:Date.now().toString(),expression:this.buffer,result:calc.error?calc.error:calc.result,timestamp:(new Date()).toISOString()});
      }catch(e){Display.showResult({error:e.message});}
    }
  };

  // Button Grid
  const ButtonGrid = {
    buttons:[
      {label:'(',value:'('},{label:')',value:')'},{label:'%',value:'%','class':'operator'},{label:'÷',value:'÷','class':'operator'},
      {label:'7',value:'7'},{label:'8',value:'8'},{label:'9',value:'9'},{label:'×',value:'×','class':'operator'},
      {label:'4',value:'4'},{label:'5',value:'5'},{label:'6',value:'6'},{label:'-',value:'-','class':'operator'},
      {label:'1',value:'1'},{label:'2',value:'2'},{label:'3',value:'3'},{label:'+',value:'+','class':'operator'},
      {label:'0',value:'0','class':'wide'},{label:'.',value:'.'},{label:'=',value:'=','class':'operator'}
    ],
    init(){
      const grid=document.getElementById('buttonGrid');
      this.buttons.forEach(btn=>{
        const el=document.createElement('button');el.className='button';if(btn.class)el.classList.add(btn.class);if(btn.class==='wide')el.classList.add('wide');
        el.textContent=btn.label;el.setAttribute('data-value',btn.value);el.setAttribute('role','gridcell');el.setAttribute('tabindex','0');
        el.addEventListener('click',()=>this.onClick(btn.value));
        grid.appendChild(el);
      });
      document.getElementById('clearBtn').addEventListener('click',()=>{InputManager.clear();});
      document.getElementById('historyBtn').addEventListener('click',()=>{UIHelpers.toggleHistory();});
    },
    onClick(val){
      if(val==='=')return InputManager.evaluate();
      if(val==='%' ){ // simple percent as divide by 100 of current number
        try{
          const calc=ParserEvaluator.calculate(InputManager.buffer);
          InputManager.buffer = String(calc.result/100);
          Display.showExpression(InputManager.buffer);
        }catch(e){Display.showResult({error:e.message})}
        return;
      }
      InputManager.append(val);
    }
  };

  // Simple UI helpers
  const UIHelpers = {
    toggleHistory(){
      const btn=document.getElementById('historyBtn');const list=document.getElementById('historyList');
      const expanded=btn.getAttribute('aria-expanded')==='true';
      if(expanded){btn.setAttribute('aria-expanded','false');list.hidden=true;}
      else{btn.setAttribute('aria-expanded','true');this.renderHistory();list.hidden=false;}
    },
    renderHistory(){const list=document.getElementById('historyList');const h=StorageManager.loadHistory();list.innerHTML='';
      if(h.length===0){list.textContent='Пусто';return}
      h.slice(0,50).forEach(item=>{const el=document.createElement('div');el.textContent=`${item.expression} = ${item.result}`;el.className='hist-item';list.appendChild(el)});
    }
  };

  // Keyboard Manager
  const KeyboardManager = {
    init(){
      window.addEventListener('keydown',e=>this.onKey(e));
    },
    onKey(e){
      if(e.key=== 'Escape'){InputManager.clear();e.preventDefault();return}
      if(e.key==='Enter'){InputManager.evaluate();e.preventDefault();return}
      if(e.key==='Backspace'){InputManager.backspace();e.preventDefault();return}
      const mapping = {
        '/':'÷','*':'×','x':'×','X':'×'
      };
      if(mapping[e.key]){InputManager.append(mapping[e.key]);e.preventDefault();return}
      if(/^[0-9]$/.test(e.key) || e.key==='.' || e.key==='(' || e.key===')' || ['+','-','/','*'].includes(e.key)){
        const v = (e.key==='/'? '÷' : e.key==='*' ? '×' : e.key);
        InputManager.append(v);e.preventDefault();return
      }
      // allow other keys to behave normally
    }
  };

  // Init
  document.addEventListener('DOMContentLoaded',()=>{
    // initial buffer
    InputManager.buffer='0';
    Display.showExpression(InputManager.buffer);

    ThemeManager.init();
    ButtonGrid.init();
    KeyboardManager.init();

    // history button
    UIHelpers.renderHistory();
  });

})();

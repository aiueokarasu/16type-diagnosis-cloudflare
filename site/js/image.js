function downloadResultImage(personality, type) {
  const canvas=document.getElementById("result-canvas"), ctx=canvas.getContext("2d"), width=1080, height=1350;canvas.width=width;canvas.height=height;
  const gradient=ctx.createLinearGradient(0,0,width,height);gradient.addColorStop(0,"#fff0f4");gradient.addColorStop(1,"#eeebff");ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
  ctx.fillStyle="#e66b83";ctx.font="700 42px sans-serif";ctx.textAlign="center";ctx.fillText("16 TYPE DIAGNOSIS",width/2,150);
  ctx.strokeStyle="#d7cbd3";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(110,205);ctx.lineTo(970,205);ctx.stroke();
  ctx.fillStyle="#342d3b";ctx.font="500 40px sans-serif";ctx.fillText("あなたは",width/2,305);ctx.font="700 68px sans-serif";wrapText(ctx,personality.name,width/2,410,800,85);ctx.fillStyle="#7565c7";ctx.font="800 90px sans-serif";ctx.fillText(type,width/2,690);
  ctx.strokeStyle="#d7cbd3";ctx.beginPath();ctx.moveTo(110,775);ctx.lineTo(970,775);ctx.stroke();ctx.fillStyle="#342d3b";ctx.font="500 43px sans-serif";ctx.fillText(`恋愛 ${"★".repeat(personality.loveRating)}${"☆".repeat(5-personality.loveRating)}`,width/2,880);ctx.fillText(`仕事 ${"★".repeat(personality.workRating)}${"☆".repeat(5-personality.workRating)}`,width/2,965);ctx.fillStyle="#796f7b";ctx.font="400 30px sans-serif";ctx.fillText("恋愛・仕事・相性までわかる無料診断",width/2,1150);ctx.fillText("16タイプ診断",width/2,1200);
  const link=document.createElement("a");link.download=`16type-${type}.png`;link.href=canvas.toDataURL("image/png");link.click();
}
function wrapText(ctx,text,x,y,maxWidth,lineHeight){const chars=[...text];let line="", lines=[];chars.forEach(char=>{if(ctx.measureText(line+char).width>maxWidth){lines.push(line);line=char;}else line+=char;});lines.push(line);lines.forEach((value,i)=>ctx.fillText(value,x,y+i*lineHeight));}

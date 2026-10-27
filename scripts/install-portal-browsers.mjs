// Install the three Linux browser distributions used by the portal journey.
import { mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const root='/tmp/rer-browsers'
mkdirSync(root,{recursive:true})
for(const [name,url,target,kind] of [
 ['chrome','https://storage.googleapis.com/chrome-for-testing-public/156.0.8078.47/linux64/chrome-linux64.zip',root+'/latest/chrome-linux64/chrome','zip'],
 ['edge','https://packages.microsoft.com/repos/edge/pool/main/m/microsoft-edge-stable/microsoft-edge-stable_156.0.4314.50-1_amd64.deb',root+'/edge-latest/opt/microsoft/msedge/msedge','deb'],
 ['brave','https://brave-browser-apt-release.s3.brave.com/pool/main/b/brave-browser/brave-browser_1.98.60_amd64.deb',root+'/brave-latest/opt/brave.com/brave/brave','deb'],
]){
 if(existsSync(target))continue
 const archive=root+'/'+name+'-latest.'+(kind==='zip'?'zip':'deb'),destination=root+'/'+(name==='chrome'?'latest':name+'-latest')
 execFileSync('curl',['--fail','--silent','--show-error','--location','--retry','2','--max-time','180','--output',archive,url],{stdio:'inherit'})
 mkdirSync(destination,{recursive:true})
 execFileSync(kind==='zip'?'unzip':'dpkg-deb',kind==='zip'?['-q','-o',archive,'-d',destination]:['-x',archive,destination],{stdio:'inherit'})
}

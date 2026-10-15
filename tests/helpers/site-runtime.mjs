import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'

export async function siteServer() {
 const root=resolve('dist/site')
 const types={'.html':'text/html; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'}
 const server=createServer(async(request,response)=>{
  const path=decodeURIComponent(new URL(request.url,'http://localhost').pathname)
  let file=resolve(root,'.'+path)
  if(file!==root&&!file.startsWith(root+'/')){response.writeHead(403).end();return}
  try {
   if(path==='/')file=resolve(root,'index.html')
   else if(!extname(file))file+='.html'
   const body=await readFile(file)
   response.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'}).end(body)
  }catch{response.writeHead(404).end('Not found')}
 })
 await new Promise(done=>server.listen(0,'127.0.0.1',done))
 return {origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(done=>server.close(done))}
}

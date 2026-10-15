#!/usr/bin/env node
import { readFile } from 'node:fs/promises'

// Tokens come from the named environment variable only, never argv or files.
const args=process.argv.slice(2),command=args.shift()
const options={}
while(args.length) {
 const key=args.shift(),value=args.shift()
 if(!['--origin','--token-env','--input','--date'].includes(key) || !value || Object.hasOwn(options,key)) { console.error('Use desk | prepare-folder | proposals --origin URL --token-env NAME [--input JSON_FILE] [--date YYYY-MM-DD]');process.exit(2) }
 options[key]=value
}
try {
 if(!['desk','prepare-folder','proposals'].includes(command)) throw Error('Choose desk, prepare-folder or proposals.')
 if(!options['--origin'] || !options['--token-env'] || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(options['--token-env'])) throw Error('Set --origin and --token-env NAME.')
 const origin=new URL(options['--origin'])
 if(!['http:','https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname!=='/' || origin.search || origin.hash) throw Error('Use a plain application origin without credentials, path or query.')
 if(origin.protocol==='http:' && !['localhost','127.0.0.1','[::1]'].includes(origin.hostname)) throw Error('Use HTTPS except on localhost.')
 const token=process.env[options['--token-env']]
 if(!token || !/^[a-f0-9]{64}$/.test(token)) throw Error('The named environment variable must contain an agent credential.')
 if(command==='prepare-folder' && !options['--input']) throw Error('prepare-folder requires --input JSON_FILE.')
 if(command!=='prepare-folder' && options['--input']) throw Error('--input is only for prepare-folder.')
 if(command!=='desk' && options['--date']) throw Error('--date is only for desk.')
 const url=new URL('/api/agent/'+command,origin)
 if(options['--date']) url.searchParams.set('date',options['--date'])
 const init={method:command==='prepare-folder'?'POST':'GET',headers:{authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(30000)}
 if(command==='prepare-folder') {
  const body=JSON.parse(await readFile(options['--input'],'utf8'))
  if(!body || typeof body!=='object' || Array.isArray(body)) throw Error('The input file must contain a folder object.')
  init.headers['content-type']='application/json';init.body=JSON.stringify(body)
 }
 const response=await fetch(url,init)
 // Never echo arbitrary transport responses; print the parsed domain response
 // only, after rejecting any accidental echo of the credential.
 const output=await response.text()
 if(output.includes(token)) throw Error('Server response refused because it included a credential.')
 let data;try {data=JSON.parse(output)} catch {throw Error('The server returned an unreadable response.')}
 if(!response.ok) throw Error('Agent request refused (HTTP '+response.status+'). '+(typeof data.error==='string'?data.error:'Check access and scope.'))
 process.stdout.write(JSON.stringify(data,null,2)+'\n')
} catch(error) {
 // Network/library errors may contain headers or URLs; keep failures bounded.
 const message=error instanceof Error && /^(Choose |Set |Use |The named |prepare-folder |--input |--date |The input |Server response |The server |Agent request )/.test(error.message)?error.message:'Agent command failed; check the origin, input file and network.'
 console.error(message);process.exitCode=1
}

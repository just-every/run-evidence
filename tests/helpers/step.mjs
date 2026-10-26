// A named step within one public-door journey; this does not register a test.
export async function step(name, run) {
 try {
  await run()
 } catch (error) {
  error.message = name + ': ' + error.message
  throw error
 }
 console.log('STEP ' + name)
}

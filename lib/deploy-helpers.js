
import fs from 'fs/promises'

export const writeEnv = (path, data) => fs.writeFile(
  path,
  Object.keys(data).map(k => `${k}=${data[k]}`).join("\n") +"\n"
)


export class MapUtil {

  static serialize<T>(map: Map<string, T>) {
    let obj: any = {}
    map.forEach((value, key) => {
      obj[key] = value
    })
    return obj
  }

  static deserialize<T>(serialized: any) {
    const map = new Map<string, T>()
    for(let key in serialized) {
      map.set(key, serialized[key])
    }
    return map
  }
}

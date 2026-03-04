export type PermissionLevel =
  | "chat"
  | "limited"
  | "full"

class PermissionManager {

  private static level: PermissionLevel = "chat"

  static setLevel(level: PermissionLevel) {
    this.level = level
  }

  static getLevel(): PermissionLevel {
    return this.level
  }

  static canRunSystemCommands(): boolean {
    return this.level === "full"
  }

  static canOpenApps(): boolean {
    return this.level === "limited" || this.level === "full"
  }

}

export default PermissionManager
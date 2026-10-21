// Compatibility facade: components import repositories without depending on SQL details.
export { noteRepository } from "./note-repository";
export { sectionRepository } from "./section-repository";
export { connectionRepository } from "./connection-repository";
export { taskRepository, type NewTask } from "./task-repository";

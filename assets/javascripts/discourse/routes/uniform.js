import DiscourseRoute from "discourse/routes/discourse";

export default class UniformRoute extends DiscourseRoute {
  model(params) {
    return { username: params?.username };
  }
}

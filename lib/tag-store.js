
class FaceActions extends Actions {
  identifyFace(userId, faceId, name) {
    return prom(done =>
      post(`/identify/${userId}/${faceId}`,
          {data: name}, done))
  }

  tagImage(userId, imageId) {
    return prom(done =>
      get(`/images/${userId}/${imageId}/tag`, done))
      .then(faces => ({
        userId,
        imageId,
        faces,
      }))
  }
}

class FaceStore extends Store {
  constructor(flux) {
    super(flux)
    this.state = {
      images: {}
      faces: {}
    }
  }

  listeners = {
    tags: {
      someAsync: {
        start(tid, val, update)
      },
      tagImage({userId, imageId, faces}, update) {
        update({
          images: {
            [imageId]: {$set: faces}
          }
        })
      },
      identifyFace(updates, update) {
        updates.forEach(face => {
          update({
            faces: {
              [face.face_id]: {
                true_name: {$set: face.true_name},
                suggestions: {$set: face.suggestions},
              }
            }
          })
        })
      }
    }
  }
}


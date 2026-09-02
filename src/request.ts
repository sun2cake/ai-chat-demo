import axios from 'axios'

const service = axios.create({
    baseURL: '/dify-api/v1',
    timeout: 30000
})

export default service

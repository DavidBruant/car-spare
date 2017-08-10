
function isUsageRateError(err){
    return Array.isArray(err.errors) && err.errors[0].domain === "usageLimits";
}

const RETRY_MINIMUM_DELAY = 25;
const MAX_PENDING = 3;

const queueByAuth = new WeakMap();

export default function withExponentialBackoff(f, auth){

    function retry(){
        const queue = queueByAuth.get(auth);
        //console.log('pending call', queue.toRetryCalls.size, queue.pendingCalls.size, queue.delay);

        // extracting 2 elements to retry. This grows exponentially the number of parallel calls after a reset
        const [tr1, tr2] = queue.toRetryCalls;

        [tr1, tr2].forEach(toRetryCall => {
            if(!toRetryCall || queue.pendingCalls.size >= MAX_PENDING) // there was only one left
                return;

            const { f, args, resolve, reject } = toRetryCall;

            queue.toRetryCalls.delete(toRetryCall);
            queue.pendingCalls.add(toRetryCall);

            f(...args)
            .then(result => {
                //console.log('successful retry', queue.toRetryCalls.size, queue.pendingCalls.size, queue.delay)
                
                if(queue.toRetryCalls.size + queue.pendingCalls.size === 0){
                    queueByAuth.delete(auth);
                }
                else{
                    queue.delay = RETRY_MINIMUM_DELAY;
                    queue.timeouts.add(setTimeout(retry, queue.delay));
                }

                resolve(result);
                queue.pendingCalls.delete(toRetryCall);
                queue.toRetryCalls.delete(toRetryCall);
            })
            .catch(err => {
                if(isUsageRateError(err)){
                    //console.log('unsuccessful retry', queue.toRetryCalls.size, queue.pendingCalls.size,  queue.delay);

                    if(queue.pendingCalls.has(toRetryCall)){
                        // reset queue
                        queue.timeouts.forEach(t => clearTimeout(t));
                        queue.timeouts = new Set();
                        queue.pendingCalls.forEach(c => {
                            queue.toRetryCalls.add(c);
                            queue.pendingCalls.delete(c);
                        });

                        queue.delay *= 2;
                        queue.timeouts.add(setTimeout(retry, queue.delay));
                    }
                }
                else{ // not a usage limit issue, forward
                    reject(err);
                    queue.pendingCalls.delete(toRetryCall);
                    queue.toRetryCalls.delete(toRetryCall);
                }
            })
        })
                        
    }

    // returns a function which does the same thing than f, but retries with exponential backoff
    // https://developers.google.com/drive/v3/web/handle-errors?hl=fr#exponential-backoff
    return function(...args){

        const queue = queueByAuth.get(auth);
        if(queue){
            // already waiting, let's not make things worse and add to queue
            return new Promise((resolve, reject) => {
                queue.toRetryCalls.add({ f, args, resolve, reject });
            })
        }
        else{
            return f(...args)
            .catch(err => {
                if(isUsageRateError(err)){
                    //console.log('usage limit error, backing off')
                    
                    return new Promise((resolve, reject) => {
                        const toRetryCall = { f, args, resolve, reject };
                        
                        // may have been created in the meantime
                        let queue = queueByAuth.get(auth);
                        if(!queue){
                            queue = {
                                delay: RETRY_MINIMUM_DELAY,
                                toRetryCalls: new Set(),
                                pendingCalls: new Set(),
                                timeouts: new Set()
                            }
                        
                            queueByAuth.set(auth, queue);
                            queue.timeouts.add(setTimeout(retry, queue.delay));
                        }
                        
                        queue.toRetryCalls.add(toRetryCall);
                    });
                }
                else{ // not a usage limit issue, forward
                    throw err;
                }
            })
        }

    }
}
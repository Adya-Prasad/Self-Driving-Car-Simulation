// --- Utility Functions ---
/**
 * A utility function for Linear Interpolation (lerp).
 * It finds a value that is a certain fraction (t) between two other values (A and B).
 * For example, lerp(10, 20, 0.5) would return 15.
 * We use this to calculate various components.
 * @param {number} A - The starting value.
 * @param {number} B - The ending value.
 * @param {number} t - The fraction (between 0 and 1) to interpolate by.
 * @returns {number} The interpolated value.
 */
function lerp(A, B, t){  // lerp: linear interpolation
    return A + (B-A)*t;
}

function getIntersection(A, B, C, D){
    const tTop = (D.x-C.x)*(A.y-C.y)-(D.y-C.y)*(A.x-C.x);
    const uTop = (C.y-A.y)*(A.x-B.x)-(C.x-A.x)*(A.y-B.y);
    const bottom = (D.y-C.y)*(B.x-A.x)-(D.x-C.x)*(B.y-A.y);

    if(bottom != 0){
        const t=tTop/bottom;
        const u=uTop/bottom;
        if(t>= 0 && t<= 1 && u >= 0 && u<= 1){
            return{
                x:lerp(A.x, B.x, t),
                y:lerp(A.y, B.y, t),
                offset:t
            }
        }
    }
    return null;
}

function polysIntersect(poly1, poly2){
    for(let i=0; i<poly1.length; i++){
        for(let j=0; j<poly2.length; j++){
            const touch=getIntersection(
                poly1[i],
                poly1[(i+1)%poly1.length],
                poly2[j],
                poly2[(j+1)%poly2.length]
            )
            if(touch){
                return true;
            }
        }
    }
    return false;
}

function getRGBA(value){
    const alpha=Math.abs(value);
    const R=value>0?0:255; // Red for negative values (inhibition)
    const G=value>0?255:0; // Green for positive values (excitation)
    const B=0;
    return "rgba("+R+","+G+","+B+","+alpha+")";
}
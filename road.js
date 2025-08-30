// Utility function for linear interpolation
function lerp(A, B, t) {
    return A + (B - A) * t;
}

class Road{
    constructor(x, width, laneCount=3, trackType="straight"){
        this.x = x;
        this.width=width;
        this.laneCount = laneCount;
        this.trackType = trackType;

        if(trackType === "curved"){
            // Initialize curved track properties
            this.trackWidth = width;
            this.trackHeight =0;
            this.centerline = {};
            this.updateDimensions(500, 400); // Default dimensions of road canvas width and height
        }else{
            // straight road logic same as version 1
            this.left=x-width/2;
            this.right=x+width/2;

            const infinity = 1000000;
            this.top =- infinity;
            this.bottom = infinity;
        
            const topLeft={x:this.left, y:this.top};
            const topRight={x:this.right, y:this.top};
            const bottomRight={x:this.right, y:this.bottom};
            const bottomLeft={x:this.left, y:this.bottom};

            this.borders=[
                [topLeft, bottomLeft],
                [topRight, bottomRight]
            ];
        }
    }

    // NEW: Method to update curved track dimensions
    updateDimensions(newWidth, newHeight){
        if(this.trackType !== "curved") return;
        
        //  track needs a center point to build around
        this.x = newWidth/2; // center x of canvas width
        this.y = newHeight / 2; // center y of canvas height
        this.trackHeight = newHeight * 0.38;

        const longStraight = newWidth * 0.48;
        const rightCurveCenter = {x:this.x + longStraight / 2, y: this.y}; // Move right from track center. store in dict object we need both x and y coordinates together
        const leftCurveCenter = {x: this.x - longStraight / 2, y: this.y};
        
        console.log("Track dimensions:", {
            center: {x: this.x, y: this.y},
            trackHeight: this.trackHeight,
            trackWidth: this.trackWidth,
            leftCenter: leftCurveCenter,
            rightCenter: rightCurveCenter
        });

        this.centerline = {
            rightArc: {type: "arc", center: rightCurveCenter, radius: this.trackHeight, startAngle: -Math.PI/2, endAngle: Math.PI/2},
            leftArc: {type: "arc", center: leftCurveCenter, radius: this.trackHeight, startAngle: Math.PI/2, endAngle: 3* Math.PI/2}
        };
        this.borders = this.#generateBorders();
    }

    // Generate borders for curved track
    #generateBorders(){
        if(this.trackType != "curved") return this.borders;

        const borders = [];
        const outerRadiusOffset = this.trackWidth/2;
        const innerRadiusOffset = -this.trackWidth/2;
        const segments = 30; // Curves are mathematically smooth, but collision detection needs straight line segments.

        for(let i=1; i <= segments; i++){
            // We need TWO points to draw a line segment:
            const t1 = (i -1)/segments; // Progress of previous point (0 to 1)
            const t2 = i / segments;  // Progress of current point (0 to 1)
            const a1_right = this.centerline.rightArc.startAngle + t1 * Math.PI;  // Previous angle
            const a2_right = this.centerline.rightArc.startAngle + t2 * Math.PI; // Current angle

            // {} creates a JavaScript OBJECT with two properties (coordinates)= x: Object start and y : object end
            // FINAL CALCULATION:
            // x: 200 + 0 * 200 = 200 + 0 = 200
            // y: 300 + 1 * 200 = 300 + 200 = 500
            borders.push([
                { x: this.centerline.rightArc.center.x + Math.cos(a1_right) * (this.trackHeight + outerRadiusOffset), y: this.centerline.rightArc.center.y + Math.sin(a1_right) * (this.trackHeight + outerRadiusOffset) },
                { x: this.centerline.rightArc.center.x + Math.cos(a2_right) * (this.trackHeight + outerRadiusOffset), y: this.centerline.rightArc.center.y + Math.sin(a2_right) * (this.trackHeight + outerRadiusOffset) }
            ]);
            borders.push([
                { x: this.centerline.rightArc.center.x + Math.cos(a1_right) * (this.trackHeight + innerRadiusOffset), y: this.centerline.rightArc.center.y + Math.sin(a1_right) * (this.trackHeight + innerRadiusOffset) },
                { x: this.centerline.rightArc.center.x + Math.cos(a2_right) * (this.trackHeight + innerRadiusOffset), y: this.centerline.rightArc.center.y + Math.sin(a2_right) * (this.trackHeight + innerRadiusOffset) }
            ]);

            const a1_left = this.centerline.leftArc.startAngle + t1 * Math.PI;
            const a2_left = this.centerline.leftArc.startAngle + t2 * Math.PI;

            borders.push([
                { x: this.centerline.leftArc.center.x + Math.cos(a1_left) * (this.trackHeight + outerRadiusOffset), y: this.centerline.leftArc.center.y + Math.sin(a1_left) * (this.trackHeight + outerRadiusOffset) },
                { x: this.centerline.leftArc.center.x + Math.cos(a2_left) * (this.trackHeight + outerRadiusOffset), y: this.centerline.leftArc.center.y + Math.sin(a2_left) * (this.trackHeight + outerRadiusOffset) }
            ]);
            borders.push([
                { x: this.centerline.leftArc.center.x + Math.cos(a1_left) * (this.trackHeight + innerRadiusOffset), y: this.centerline.leftArc.center.y + Math.sin(a1_left) * (this.trackHeight + innerRadiusOffset) },
                { x: this.centerline.leftArc.center.x + Math.cos(a2_left) * (this.trackHeight + innerRadiusOffset), y: this.centerline.leftArc.center.y + Math.sin(a2_left) * (this.trackHeight + innerRadiusOffset) }
            ]);
        
        }
         // Add straight sections
         borders.push([
            {x: this.centerline.leftArc.center.x, y: this.centerline.leftArc.center.y - (this.trackHeight + outerRadiusOffset)},
            {x: this.centerline.rightArc.center.x, y: this.centerline.rightArc.center.y - (this.trackHeight + outerRadiusOffset)}
        ]);
        borders.push([
            {x: this.centerline.leftArc.center.x, y: this.centerline.leftArc.center.y - (this.trackHeight + innerRadiusOffset)},
            {x: this.centerline.rightArc.center.x, y: this.centerline.rightArc.center.y - (this.trackHeight + innerRadiusOffset)}
        ]);
        borders.push([
            {x: this.centerline.leftArc.center.x, y: this.centerline.leftArc.center.y + (this.trackHeight + outerRadiusOffset)},
            {x: this.centerline.rightArc.center.x, y: this.centerline.rightArc.center.y + (this.trackHeight + outerRadiusOffset)}
        ]);
        borders.push([
            {x: this.centerline.leftArc.center.x, y: this.centerline.leftArc.center.y + (this.trackHeight + innerRadiusOffset)},
            {x: this.centerline.rightArc.center.x, y: this.centerline.rightArc.center.y + (this.trackHeight + innerRadiusOffset)}
        ]);

        return borders;
        
    }
    
    getLaneCenter(laneIndex, t = 0){
        if(this.trackType === "curved"){
            // Ensure centerline is initialized
            if(!this.centerline.rightArc){
                return { x: this.x, y: this.y }; // Fallback to center
            }
            
            // Calculate position on track using parameter t (0 to 2π)
            // Follow the actual oval track shape: straights + curves
            
            const laneWidth = this.trackWidth / this.laneCount;
            const laneOffset = (laneIndex - 1) * laneWidth; // Lane 0=-laneWidth, Lane 1=0, Lane 2=+laneWidth
            
            let centerX, centerY, trackAngle;
            
            // Normalize t to 0-2π range
            t = ((t % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
            
            if (t >= 0 && t < Math.PI/2) {
                // Top straight section (t: 0 to π/2)
                const progress = t / (Math.PI/2);
                centerX = lerp(this.centerline.leftArc.center.x, this.centerline.rightArc.center.x, progress);
                centerY = this.y - this.trackHeight;
                trackAngle = 0; // Moving right
            } else if (t >= Math.PI/2 && t < Math.PI) {
                // Right curve (t: π/2 to π)
                const curveProgress = (t - Math.PI/2) / (Math.PI/2);
                const curveAngle = -Math.PI/2 + curveProgress * Math.PI;
                centerX = this.centerline.rightArc.center.x + Math.cos(curveAngle) * this.trackHeight;
                centerY = this.centerline.rightArc.center.y + Math.sin(curveAngle) * this.trackHeight;
                trackAngle = curveAngle + Math.PI/2; // Tangent to curve
            } else if (t >= Math.PI && t < 3*Math.PI/2) {
                // Bottom straight section (t: π to 3π/2)
                const progress = (t - Math.PI) / (Math.PI/2);
                centerX = lerp(this.centerline.rightArc.center.x, this.centerline.leftArc.center.x, progress);
                centerY = this.y + this.trackHeight;
                trackAngle = Math.PI; // Moving left
            } else {
                // Left curve (t: 3π/2 to 2π)
                const curveProgress = (t - 3*Math.PI/2) / (Math.PI/2);
                const curveAngle = Math.PI/2 + curveProgress * Math.PI;
                centerX = this.centerline.leftArc.center.x + Math.cos(curveAngle) * this.trackHeight;
                centerY = this.centerline.leftArc.center.y + Math.sin(curveAngle) * this.trackHeight;
                trackAngle = curveAngle + Math.PI/2; // Tangent to curve
            }
            
            // Apply lane offset perpendicular to track direction
            const offsetX = laneOffset * Math.cos(trackAngle + Math.PI/2);
            const offsetY = laneOffset * Math.sin(trackAngle + Math.PI/2);
            
            return {
                x: centerX + offsetX,
                y: centerY + offsetY
            };
        } else{
            // Original straight road logic
            const laneWidth = this.width / this.laneCount;
            return this.left + laneWidth/2 + Math.min(laneIndex, this.laneCount-1) * laneWidth;
        }
    }

    draw(ctx){
        ctx.save();

        if(this.trackType === "curved"){
            this.#drawCurvedTrack(ctx);
        } else {
            this.#drawStraightRoad(ctx);
        }

        ctx.restore();
    }

    #drawStraightRoad(ctx){
        ctx.lineWidth = 5;
        ctx.strokeStyle = "white";

        for(let i=1; i <=this.laneCount-1; i++){
            const x = lerp(this.left, this.right, i/this.laneCount);
            ctx.setLineDash([20, 20]);
            ctx.beginPath();
            ctx.moveTo(x, this.top);
            ctx.lineTo(x, this.bottom);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        this.borders.forEach(border => {
            ctx.beginPath();
            ctx.moveTo(border[0].x, border[0].y);
            ctx.lineTo(border[1].x, border[1].y);
            ctx.stroke();
        });
    }
    #drawCurvedTrack(ctx){
        // Draw the road surface
        ctx.fillStyle = '#858585';
        
        const outerRadius = this.trackHeight + this.trackWidth / 2;
        const innerRadius = this.trackHeight - this.trackWidth / 2;
        
        // Draw outer boundary
        ctx.beginPath();
        ctx.moveTo(this.centerline.rightArc.center.x, this.centerline.rightArc.center.y - outerRadius);
        ctx.arc(this.centerline.rightArc.center.x, this.centerline.rightArc.center.y, outerRadius, -Math.PI/2, Math.PI/2);
        ctx.lineTo(this.centerline.leftArc.center.x, this.centerline.leftArc.center.y + outerRadius);
        ctx.arc(this.centerline.leftArc.center.x, this.centerline.leftArc.center.y, outerRadius, Math.PI/2, 3*Math.PI/2);
        ctx.closePath();
        ctx.fill();
        
        // Cut out inner hole
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(this.centerline.rightArc.center.x, this.centerline.rightArc.center.y - innerRadius);
        ctx.arc(this.centerline.rightArc.center.x, this.centerline.rightArc.center.y, innerRadius, -Math.PI/2, Math.PI/2);
        ctx.lineTo(this.centerline.leftArc.center.x, this.centerline.leftArc.center.y + innerRadius);
        ctx.arc(this.centerline.leftArc.center.x, this.centerline.leftArc.center.y, innerRadius, Math.PI/2, 3*Math.PI/2);
        ctx.closePath();
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        // Draw lane lines
        ctx.lineWidth = 4;
        ctx.strokeStyle = "white";
        for (let i = 1; i <= this.laneCount - 1; i++) {
            const t = i / this.laneCount;
            const laneOffset = lerp(this.trackWidth / 2, -this.trackWidth / 2, t);
            
            ctx.setLineDash([20, 20]);
            
            // Top straight
            ctx.beginPath();
            ctx.moveTo(this.centerline.leftArc.center.x, (this.y - this.trackHeight) + laneOffset);
            ctx.lineTo(this.centerline.rightArc.center.x, (this.y - this.trackHeight) + laneOffset);
            ctx.stroke();

            // Bottom straight
            ctx.beginPath();
            ctx.moveTo(this.centerline.leftArc.center.x, (this.y + this.trackHeight) + laneOffset);
            ctx.lineTo(this.centerline.rightArc.center.x, (this.y + this.trackHeight) + laneOffset);
            ctx.stroke();
            
            const laneRadius = this.trackHeight - laneOffset;

            // Right curve
            ctx.beginPath();
            ctx.arc(this.centerline.rightArc.center.x, this.centerline.rightArc.center.y, laneRadius, this.centerline.rightArc.startAngle, this.centerline.rightArc.endAngle);
            ctx.stroke();

            // Left curve
            ctx.beginPath();
            ctx.arc(this.centerline.leftArc.center.x, this.centerline.leftArc.center.y, laneRadius, this.centerline.leftArc.startAngle, this.centerline.leftArc.endAngle);
            ctx.stroke();
        }

        // Draw borders
        ctx.setLineDash([]);
        this.borders.forEach(border => {
            ctx.beginPath();
            ctx.moveTo(border[0].x, border[0].y);
            ctx.lineTo(border[1].x, border[1].y);
            ctx.stroke();
        });
    }
}
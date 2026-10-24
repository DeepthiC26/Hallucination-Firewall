import { tokenOverlap } from "../lib/evidence-intelligence/refine";

const claim = "Under the Quantum Flux Limitation Protocol, all temporal claims are restricted to 42 sub-cycles per fiscal year.";
const s1 = "[File: Constitution Of India.csv | Row 418] Articles: 357. Exercise of legislative powers under Proclamation issued under Article 356";
const s2 = "(1) Whereby a Proclamation issued under clause ( 1 ) of Article 356, it has been declared that the powers of the Legislature of the State shall be exercisable by or under the authority of Parliament, it shall be competent";
const s3 = "(a) for Parliament to confer on the President of India";

console.log("Overlap s1:", tokenOverlap(claim, s1));
console.log("Overlap s2:", tokenOverlap(claim, s2));
console.log("Overlap s3:", tokenOverlap(claim, s3));
